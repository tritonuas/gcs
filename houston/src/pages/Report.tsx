// FILE: Report.tsx (Refactored for Persistence, Undefined=0, and 404 Debugging)

// =======================================================================
// == IMPORTANT: MAKE SURE YOU HAVE REGENERATED obc.pb.ts FROM THE   	==
// ==        	UPDATED .proto FILE BEFORE USING THIS CODE!        	==
// =======================================================================

import React, {
    useState,
    useEffect,
    useMemo,
    useCallback,
    useRef,
} from "react";
import {
    Box,
    Grid,
    Card,
    CardContent,
    Chip,
    Typography,
    Select,
    MenuItem,
    Button,
    CircularProgress,
    Alert,
    SelectChangeEvent,
    TableContainer,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Paper,
    FormControl,
    InputLabel,
    FormHelperText,
    Divider,
    Snackbar,
} from "@mui/material";

import {
    IdentifiedTarget,
    AirdropIndex,
    ODLCObjects,
    airdropIndexToJSON,
    oDLCObjectsToJSON,
    oDLCObjectsFromJSON,
    airdropIndexFromJSON,
    GPSCoord,
    BboxProto,
    AirdropTarget,
} from "../protos/obc.pb"; // Adjust path as needed

import "./Report.css"; // Assuming you have this CSS file

// --- Constants ---
const POLLING_INTERVAL_MS = 10000;
const API_BASE_URL = "/api"; // <-- Verify this matches proxy/backend base path
const TARGETS_ALL_ENDPOINT = `${API_BASE_URL}/targets/all`;
const TARGET_MATCHED_ENDPOINT = `${API_BASE_URL}/targets/matched`;
const SAVE_LOAD_REPORT_ENDPOINT = `${API_BASE_URL}/report`; // For GET and POST of imageRuns
const REQUIRED_AIRDROP_INDICES = [
    AirdropIndex.Kaz,
    AirdropIndex.Kimi,
    AirdropIndex.Chris,
    AirdropIndex.Daniel,
];
const PLACEHOLDER_OBJECT_TYPE = ODLCObjects.Undefined;

// --- Helper Functions ---
const fetchTargets = async (): Promise<IdentifiedTarget[]> => {
    try {
        const response = await fetch(TARGETS_ALL_ENDPOINT);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data))
            throw new Error("Invalid data format from /targets/all");
        return data.map((item) => IdentifiedTarget.fromJSON(item));
    } catch (error) {
        console.error("Error fetching targets from /targets/all:", error);
        throw error;
    }
};

const postMatchedTargets = async (
    payload: AirdropTarget[]
): Promise<boolean> => {
    console.log(
        `POSTING FINAL MATCHES to ${TARGET_MATCHED_ENDPOINT}:`,
        payload
    );
    const jsonPayload = payload.map((target) => AirdropTarget.toJSON(target));
    try {
        const response = await fetch(TARGET_MATCHED_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(jsonPayload),
        });
        if (!response.ok) {
            const errorBody = await response.text().catch(() => "");
            console.error(
                `POST to ${TARGET_MATCHED_ENDPOINT} failed with status ${response.status}`,
                errorBody
            );
            if (response.status === 404) {
                throw new Error(
                    `Endpoint not found (${response.status}): POST ${TARGET_MATCHED_ENDPOINT}. Check backend route and dev proxy.`
                );
            } else {
                throw new Error(
                    `HTTP ${response.status} - ${
                        errorBody || response.statusText
                    }`
                );
            }
        }
        console.log("POST successful:", jsonPayload);
        return true;
    } catch (error) {
        console.error("Error posting final matched targets:", error);
        throw error;
    }
};

// New helper to fetch saved runs
const fetchSavedRunsFromServer = async (): Promise<IdentifiedTarget[]> => {
    try {
        const response = await fetch(SAVE_LOAD_REPORT_ENDPOINT);
        if (!response.ok) {
            // For 404, it might mean no saved data yet, which is not a hard error for this function
            if (response.status === 404) {
                console.log("No saved runs found on server (404).");
                return [];
            }
            throw new Error(`HTTP ${response.status} fetching saved runs`);
        }
        // Check for empty response body before .json()
        const text = await response.text();
        if (!text) {
            console.log(
                "Received empty response body from saved runs endpoint."
            );
            return [];
        }
        const data = JSON.parse(text);

        if (!Array.isArray(data)) {
            // Handle if server sends "{}" for empty instead of "[]"
            if (typeof data === "object" && Object.keys(data).length === 0) {
                console.warn(
                    "Saved runs endpoint returned an empty object, expected array. Treating as no runs."
                );
                return [];
            }
            throw new Error(
                "Invalid data format for saved runs (expected array)"
            );
        }
        return data.map((item) => IdentifiedTarget.fromJSON(item));
    } catch (error) {
        console.error("Error fetching saved runs:", error);
        // Don't throw, allow app to continue, but log it.
        // Could set an error state if critical.
        return [];
    }
};

// New helper to push runs to be saved
const pushSavedRunsToServer = async (
    runsToSave: IdentifiedTarget[]
): Promise<boolean> => {
    console.log(
        `Pushing ${runsToSave.length} runs to ${SAVE_LOAD_REPORT_ENDPOINT}`
    );
    const jsonPayload = runsToSave.map((run) => IdentifiedTarget.toJSON(run));
    try {
        const response = await fetch(SAVE_LOAD_REPORT_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(jsonPayload),
        });
        if (!response.ok) {
            const errorBody = await response.text().catch(() => "");
            throw new Error(
                `HTTP ${response.status} pushing saved runs - ${
                    errorBody || response.statusText
                }`
            );
        }
        return true;
    } catch (error) {
        console.error("Error pushing saved runs:", error);
        throw error; // Rethrow to be handled by caller
    }
};

/** Interface representing a single detection within an Image Run */
interface DetectionInfo {
    runId: number;
    detectionIndex: number;
    compositeKey: string;
    coordinate: GPSCoord;
    bbox: BboxProto;
}

/* Interface for storing the user's match *for the current image* */
interface CurrentDetectionMatch {
    airdropIndex: AirdropIndex;
    objectType: ODLCObjects;
    detectionInfo: DetectionInfo;
}

// --- Component ---
const Reports: React.FC = () => {
    const [imageRuns, setImageRuns] = useState<IdentifiedTarget[]>([]);
    const [currentRunIndex, setCurrentRunIndex] = useState<number>(0);
    const [seenRunIds, setSeenRunIds] = useState<Set<number>>(new Set());
    const [currentDetectionMatches, setCurrentDetectionMatches] = useState<{
        [key: string]: CurrentDetectionMatch | undefined;
    }>({});
    const [submittedTargets, setSubmittedTargets] = useState<{
        [key in AirdropIndex]?: AirdropTarget;
    }>({});
    const [isCurrentRunProcessed, setIsCurrentRunProcessed] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPolling, setIsPolling] = useState<boolean>(false);
    const [isConfirming, setIsConfirming] = useState<boolean>(false);
    const [isFinalSubmitting, setIsFinalSubmitting] = useState<boolean>(false);
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState("");

    // New state for persistence flow
    const [hasLoadedInitialSavedRuns, setHasLoadedInitialSavedRuns] =
        useState(false);
    const [isSavingRuns, setIsSavingRuns] = useState(false); // Prevent concurrent saves

    const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
    const isMountedRef = useRef<boolean>(true);
    const imageContainerRef = useRef<HTMLDivElement>(null);

    const processFetchedRuns = useCallback(
        (fetchedRuns: IdentifiedTarget[]): boolean => {
            let newValidRunsAddedToState = false;
            const currentRunIdsInState = new Set(imageRuns.map((r) => r.runId));

            const newValidRuns = fetchedRuns.filter((run) => {
                if (
                    seenRunIds.has(run.runId) ||
                    currentRunIdsInState.has(run.runId)
                ) {
                    return false;
                }
                const numCoords = run.coordinates?.length ?? 0;
                const numBBoxes = run.bboxes?.length ?? 0;
                const hasDetections =
                    numCoords > 0 &&
                    numBBoxes > 0 &&
                    Math.min(numCoords, numBBoxes) > 0;

                if (
                    !hasDetections &&
                    !seenRunIds.has(run.runId) &&
                    isMountedRef.current
                ) {
                    // Mark runs without detections as seen to avoid re-processing
                    setSeenRunIds((prev) => new Set(prev).add(run.runId));
                }
                return hasDetections;
            });

            if (newValidRuns.length > 0) {
                newValidRunsAddedToState = true;
                if (isMountedRef.current) {
                    setImageRuns((prevRuns) => {
                        const updatedRuns = [...prevRuns, ...newValidRuns];
                        updatedRuns.sort((a, b) => a.runId - b.runId); // Keep sorted
                        if (
                            prevRuns.length === 0 &&
                            updatedRuns.length > 0 &&
                            currentRunIndex === 0
                        ) {
                            // Set currentRunIndex to 0 only if it's the first time runs are populated
                            // And currentRunIndex hasn't been set by user interaction or previous saved state
                            setTimeout(() => {
                                if (
                                    isMountedRef.current &&
                                    currentRunIndex === 0
                                )
                                    setCurrentRunIndex(0);
                            }, 0);
                        }
                        return updatedRuns;
                    });
                    setSeenRunIds((prevIds) => {
                        const u = new Set(prevIds);
                        newValidRuns.forEach((r) => u.add(r.runId));
                        return u;
                    });
                }
            }
            return newValidRunsAddedToState;
        },
        [seenRunIds, imageRuns, currentRunIndex] // Added imageRuns, currentRunIndex
    );

    const fetchAndProcessLatest = useCallback(
        async (isInitialFetch = false) => {
            if (isPolling && !isInitialFetch) return;
            if (!isInitialFetch && !isPolling) setIsPolling(true); // Set polling true for non-initial, non-concurrent calls

            try {
                const fetched = await fetchTargets(); // Fetches from /targets/all
                if (isMountedRef.current) {
                    processFetchedRuns(fetched);
                    // Saving is handled by useEffect on imageRuns change
                }
                if (isMountedRef.current) setError(null);
            } catch (
                err: any // eslint-disable-line @typescript-eslint/no-explicit-any
            ) {
                if (isMountedRef.current) {
                    setError(`Fetch failed: ${err.message}`);
                    setSnackbarMessage(
                        `Error fetching new runs: ${err.message}`
                    );
                    setSnackbarOpen(true);
                }
            } finally {
                if (isMountedRef.current && !isInitialFetch)
                    setIsPolling(false);
            }
        },
        [processFetchedRuns, isPolling]
    );

    // Effect for initial loading and polling
    useEffect(() => {
        isMountedRef.current = true;

        const initializeAndStartPolling = async () => {
            // 1. Try to load saved runs
            try {
                setSnackbarMessage("Loading saved run data...");
                setSnackbarOpen(true);
                const savedRuns = await fetchSavedRunsFromServer();
                if (isMountedRef.current && savedRuns.length > 0) {
                    processFetchedRuns(savedRuns); // This updates imageRuns and seenRunIds
                    setSnackbarMessage(
                        `Loaded ${savedRuns.length} saved run(s).`
                    );
                } else if (isMountedRef.current) {
                    setSnackbarMessage("No saved run data found.");
                }
                setSnackbarOpen(true);
            } catch (
                loadError: any // eslint-disable-line @typescript-eslint/no-explicit-any
            ) {
                console.error(
                    "Error loading saved runs during init:",
                    loadError
                );
                if (isMountedRef.current) {
                    setError(
                        `Failed to load saved run data: ${loadError.message}`
                    );
                    setSnackbarMessage(
                        `Error loading saved runs: ${loadError.message}`
                    );
                    setSnackbarOpen(true);
                }
            } finally {
                if (isMountedRef.current) {
                    setHasLoadedInitialSavedRuns(true); // Gate for saving useEffect
                }
            }

            // 2. Perform the initial fetch for any *new* runs from /targets/all
            if (isMountedRef.current) {
                await fetchAndProcessLatest(true); // isInitialFetch = true
            }

            // 3. Start polling
            if (isMountedRef.current) {
                intervalIdRef.current = setInterval(
                    () => fetchAndProcessLatest(false), // isInitialFetch = false
                    POLLING_INTERVAL_MS
                );
            }
        };

        initializeAndStartPolling();

        return () => {
            isMountedRef.current = false;
            if (intervalIdRef.current) clearInterval(intervalIdRef.current);
        };
    }, [fetchAndProcessLatest, processFetchedRuns]); // Dependencies

    // Effect for saving imageRuns when they change
    useEffect(() => {
        // Only save if initial load is complete, there are runs, and not currently saving
        if (
            hasLoadedInitialSavedRuns &&
            imageRuns.length > 0 &&
            !isSavingRuns
        ) {
            const saveRuns = async () => {
                if (!isMountedRef.current) return;
                setIsSavingRuns(true);
                // console.log("Attempting to save imageRuns due to change:", imageRuns.map(r => r.runId));
                try {
                    await pushSavedRunsToServer(imageRuns); // imageRuns here is the latest state
                    console.log(
                        "Successfully pushed updated imageRuns to server."
                    );
                    // Optional: Snackbar for successful save, but can be noisy
                    // setSnackbarMessage("Run data auto-saved.");
                    // setSnackbarOpen(true);
                } catch (
                    pushError: any // eslint-disable-line @typescript-eslint/no-explicit-any
                ) {
                    console.error("Error auto-saving runs:", pushError);
                    if (isMountedRef.current) {
                        setSnackbarMessage(
                            `Error auto-saving run data: ${pushError.message}`
                        );
                        setSnackbarOpen(true);
                    }
                } finally {
                    if (isMountedRef.current) setIsSavingRuns(false);
                }
            };
            // Debounce or throttle this if imageRuns can change very rapidly
            // For now, direct call with isSavingRuns guard
            saveRuns();
        }
    }, [imageRuns, hasLoadedInitialSavedRuns, isSavingRuns]);

    // --- Memoized Derived State (unchanged) ---
    const currentRun = useMemo(
        () =>
            imageRuns.length > 0 &&
            currentRunIndex >= 0 &&
            currentRunIndex < imageRuns.length
                ? imageRuns[currentRunIndex]
                : null,
        [imageRuns, currentRunIndex]
    );
    const currentDetections = useMemo((): DetectionInfo[] => {
        if (!currentRun) return [];
        const detections: DetectionInfo[] = [];
        const coords = currentRun.coordinates ?? [];
        const bboxes = currentRun.bboxes ?? [];
        const numDetections = Math.min(coords.length, bboxes.length);
        if (coords.length !== bboxes.length && numDetections > 0)
            console.warn(
                `Run ${currentRun.runId}: Coord/Bbox mismatch. Coords: ${coords.length}, BBoxes: ${bboxes.length}`
            );
        for (let i = 0; i < numDetections; i++) {
            if (coords[i] && bboxes[i])
                detections.push({
                    runId: currentRun.runId,
                    detectionIndex: i,
                    compositeKey: `${currentRun.runId}-${i}`,
                    coordinate: coords[i],
                    bbox: bboxes[i],
                });
        }
        return detections;
    }, [currentRun]);

    const canConfirmCurrentImage = useMemo(() => {
        return Object.values(currentDetectionMatches).some(
            (match) =>
                match &&
                match.airdropIndex !== undefined &&
                match.airdropIndex !== AirdropIndex.UNRECOGNIZED &&
                match.objectType !== undefined &&
                match.objectType !== ODLCObjects.UNRECOGNIZED &&
                match.objectType !== PLACEHOLDER_OBJECT_TYPE
        );
    }, [currentDetectionMatches]);

    const canSubmitFinalMatches = useMemo(() => {
        return REQUIRED_AIRDROP_INDICES.every(
            (index) =>
                submittedTargets[index] !== undefined &&
                submittedTargets[index]?.Object !== ODLCObjects.Undefined
        );
    }, [submittedTargets]);

    // --- Event Handlers (mostly unchanged internally, just context might differ) ---
    const handleMatchUpdate = (
        compositeKey: string,
        field: "airdropIndex" | "objectType",
        event: SelectChangeEvent<string | number>,
        detectionInfo: DetectionInfo
    ) => {
        const selectedJsonValue = event.target.value;
        let selectedEnumValue: AirdropIndex | ODLCObjects | undefined | "" = "";

        if (selectedJsonValue === "") selectedEnumValue = "";
        else {
            try {
                if (field === "airdropIndex")
                    selectedEnumValue = airdropIndexFromJSON(selectedJsonValue);
                else selectedEnumValue = oDLCObjectsFromJSON(selectedJsonValue);
                if (
                    selectedEnumValue === AirdropIndex.UNRECOGNIZED ||
                    selectedEnumValue === ODLCObjects.UNRECOGNIZED
                ) {
                    console.warn(
                        "Invalid enum value selected:",
                        selectedJsonValue
                    );
                    return;
                }
            } catch (e) {
                console.error(
                    "Enum conversion error for value:",
                    selectedJsonValue,
                    e
                );
                return;
            }
        }

        setCurrentDetectionMatches((prev) => {
            const updatedMatches = { ...prev };
            const currentMatchData = updatedMatches[compositeKey];
            const defaultObjectType = ODLCObjects.Undefined;
            let newMatch: CurrentDetectionMatch | undefined = undefined;

            if (field === "airdropIndex") {
                if (selectedEnumValue === "") {
                    // Clearing airdrop index
                    delete updatedMatches[compositeKey]; // Remove the whole match for this detection
                } else if (
                    typeof selectedEnumValue === "number" &&
                    selectedEnumValue in AirdropIndex
                ) {
                    const newAirdropIndex = selectedEnumValue as AirdropIndex;
                    newMatch = {
                        airdropIndex: newAirdropIndex,
                        objectType:
                            currentMatchData?.objectType ?? defaultObjectType,
                        detectionInfo: detectionInfo,
                    };
                }
            } else {
                // objectType
                if (!currentMatchData) {
                    console.warn(
                        "Cannot set objectType, no airdrop index assigned to this detection yet."
                    );
                    return prev; // No change if trying to set objectType without an airdropIndex
                }
                if (selectedEnumValue === "") {
                    // Clearing object type, set to Undefined
                    newMatch = {
                        ...currentMatchData,
                        objectType: ODLCObjects.Undefined,
                    };
                } else if (
                    typeof selectedEnumValue === "number" &&
                    selectedEnumValue in ODLCObjects
                ) {
                    const newObjectType = selectedEnumValue as ODLCObjects;
                    newMatch = {
                        ...currentMatchData,
                        objectType: newObjectType,
                    };
                }
            }

            if (newMatch) updatedMatches[compositeKey] = newMatch;
            else if (field === "airdropIndex" && selectedEnumValue === "") {
                /* handled by delete */
            } else if (!newMatch) {
                return prev; // Avoid update if logic didn't produce a newMatch (e.g. invalid enum)
            }
            return updatedMatches;
        });
        if (isCurrentRunProcessed) setIsCurrentRunProcessed(false);
    };

    const handleConfirmLocalMatches = () => {
        if (!currentRun || !canConfirmCurrentImage || isConfirming) return;
        setIsConfirming(true);
        setError(null);
        let confirmedCount = 0;
        let overwriteCount = 0;
        const updatesToSubmittedTargets: {
            [key in AirdropIndex]?: AirdropTarget;
        } = {};

        Object.values(currentDetectionMatches).forEach((match) => {
            if (
                match &&
                match.airdropIndex !== undefined &&
                match.airdropIndex !== AirdropIndex.UNRECOGNIZED &&
                match.objectType !== undefined &&
                match.objectType !== ODLCObjects.UNRECOGNIZED &&
                match.objectType !== PLACEHOLDER_OBJECT_TYPE &&
                match.detectionInfo
            ) {
                if (submittedTargets[match.airdropIndex]) {
                    overwriteCount++;
                }
                const confirmedTarget = AirdropTarget.create({
                    Index: match.airdropIndex,
                    Coordinate: match.detectionInfo.coordinate,
                    Object: match.objectType,
                });
                updatesToSubmittedTargets[match.airdropIndex] = confirmedTarget;
                confirmedCount++;
            }
        });

        setSubmittedTargets((prev) => ({
            ...prev,
            ...updatesToSubmittedTargets,
        }));
        let message = `Confirmed ${confirmedCount} match(es) from Run ${currentRun.runId}.`;
        if (overwriteCount > 0) message += ` (${overwriteCount} overwritten).`;
        setSnackbarMessage(message);
        setSnackbarOpen(true);
        setIsCurrentRunProcessed(true);
        setIsConfirming(false);
    };

    const handleFinalSubmit = async () => {
        if (!canSubmitFinalMatches || isFinalSubmitting) return;
        setIsFinalSubmitting(true);
        setError(null);

        const finalPayload = Object.values(submittedTargets).filter(
            (target): target is AirdropTarget =>
                target !== undefined && target.Object !== ODLCObjects.Undefined
        );

        if (finalPayload.length !== REQUIRED_AIRDROP_INDICES.length) {
            console.error(
                "Final submit: Payload incomplete or contains Undefined objects.",
                finalPayload
            );
            setError(
                "Internal error: Incomplete final target list. Ensure all targets have a defined object type."
            );
            setIsFinalSubmitting(false);
            return;
        }

        try {
            const success = await postMatchedTargets(finalPayload);
            if (success && isMountedRef.current) {
                setSnackbarMessage(
                    "All required targets successfully submitted!"
                );
                setSnackbarOpen(true);
                // Potentially clear submittedTargets or mark as "sent"
            }
        } catch (
            postError: any // eslint-disable-line @typescript-eslint/no-explicit-any
        ) {
            console.error("Final submission failed:", postError);
            if (isMountedRef.current) {
                setError(
                    `Final submission failed: ${
                        postError.message || "Unknown error"
                    }`
                );
            }
        } finally {
            if (isMountedRef.current) setIsFinalSubmitting(false);
        }
    };

    const handleNextImage = () => {
        if (!isMountedRef.current || isConfirming || isFinalSubmitting) return;
        if (currentRunIndex < imageRuns.length - 1) {
            const nextIndex = currentRunIndex + 1;
            setCurrentRunIndex(nextIndex);
            setCurrentDetectionMatches({});
            setIsCurrentRunProcessed(false);
            setError(null);
        } else {
            if (imageRuns.length > 0) {
                // Only show "End of loaded" if there were images
                setSnackbarMessage(
                    isPolling
                        ? "Waiting for more images..."
                        : "End of loaded images."
                );
                setSnackbarOpen(true);
            }
        }
    };
    const handleSnackbarClose = () => setSnackbarOpen(false);

    // --- Rendering Helpers (unchanged) ---
    const formatCoordinates = (coord: GPSCoord | undefined): string => {
        if (!coord) return "N/A";
        const lat =
            typeof coord.Latitude === "number"
                ? coord.Latitude.toFixed(5)
                : "N/A";
        const lon =
            typeof coord.Longitude === "number"
                ? coord.Longitude.toFixed(5)
                : "N/A";
        return `(${lat}, ${lon})`;
    };
    const renderTargetLabel = (index: number): string =>
        `Detection ${String.fromCharCode(65 + index)}`;

    const calculateDetectionStyles = (
        detection: DetectionInfo,
        index: number
    ): {
        bboxStyle: React.CSSProperties;
        labelStyle: React.CSSProperties;
        labelText: string;
        isValid: boolean;
    } => {
        const defaultStyles = {
            bboxStyle: {},
            labelStyle: {},
            labelText: renderTargetLabel(index),
            isValid: false,
        };
        const match = currentDetectionMatches[detection.compositeKey];
        const isAssigned =
            match?.airdropIndex !== undefined &&
            match.airdropIndex !== AirdropIndex.UNRECOGNIZED;
        const color = isAssigned ? "lime" : "cyan";

        const container = imageContainerRef.current;
        const imgElement = container?.querySelector(
            "img.reports-current-image"
        ) as HTMLImageElement | null;

        if (
            !container ||
            !imgElement ||
            !imgElement.complete ||
            imgElement.naturalWidth === 0 ||
            imgElement.naturalHeight === 0
        ) {
            // Return default if image isn't loaded or container not ready
            // This prevents errors if calculateDetectionStyles runs before image is fully rendered
            return defaultStyles;
        }

        const containerWidth = container.offsetWidth;
        const containerHeight = container.offsetHeight;
        const naturalWidth = imgElement.naturalWidth;
        const naturalHeight = imgElement.naturalHeight;
        const naturalRatio = naturalWidth / naturalHeight;
        const containerRatio = containerWidth / containerHeight;

        let scale: number;
        let displayedWidth: number;
        let displayedHeight: number;
        let offsetX: number;
        let offsetY: number;

        if (naturalRatio > containerRatio) {
            displayedWidth = containerWidth;
            displayedHeight = displayedWidth / naturalRatio;
            scale = displayedWidth / naturalWidth;
            offsetX = 0;
            offsetY = (containerHeight - displayedHeight) / 2;
        } else {
            displayedHeight = containerHeight;
            displayedWidth = displayedHeight * naturalRatio;
            scale = displayedHeight / naturalHeight;
            offsetX = (containerWidth - displayedWidth) / 2;
            offsetY = 0;
        }

        const { x1, y1, x2, y2 } = detection.bbox ?? {};
        if (x1 == null || y1 == null || x2 == null || y2 == null)
            return defaultStyles; // Bbox values must exist

        const scaledX1 = offsetX + x1 * scale;
        const scaledY1 = offsetY + y1 * scale;
        const scaledWidth = Math.max(0, (x2 - x1) * scale);
        const scaledHeight = Math.max(0, (y2 - y1) * scale);

        const isValid = scaledWidth > 1 && scaledHeight > 1; // Use a threshold slightly > 0
        if (!isValid)
            return {
                ...defaultStyles,
                labelText: `${renderTargetLabel(index)} (scaled small)`,
            };

        const bboxStyle: React.CSSProperties = {
            position: "absolute",
            left: `${scaledX1}px`,
            top: `${scaledY1}px`,
            width: `${scaledWidth}px`,
            height: `${scaledHeight}px`,
            border: `2px solid ${color}`,
            pointerEvents: "none",
            boxSizing: "border-box",
        };
        const labelStyle: React.CSSProperties = {
            position: "absolute",
            left: `${scaledX1}px`,
            top: `${scaledY1 - 20}px`,
            color: color,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            padding: "2px 5px",
            fontSize: "0.8rem",
            fontWeight: "bold",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            borderRadius: "3px",
            zIndex: 10,
        };
        return {
            bboxStyle,
            labelStyle,
            labelText: renderTargetLabel(index),
            isValid: true,
        };
    };

    // --- Main Render Function ---
    return (
        <Box className="reports-container" sx={{ p: 2 }}>
            {/* Global Error Alert (excluding confirm/submit phases) */}
            {error && !isConfirming && !isFinalSubmitting && (
                <Alert
                    severity="warning"
                    sx={{ mb: 2 }}
                    onClose={() => setError(null)}
                >
                    {error}
                </Alert>
            )}
            <Snackbar
                open={snackbarOpen}
                autoHideDuration={isSavingRuns || isPolling ? 2000 : 6000} // Shorter for transient messages
                onClose={handleSnackbarClose}
                message={snackbarMessage}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            />

            <Grid container spacing={2}>
                {/* === Top Row: Queue & Status === */}
                <Grid item xs={12} md={8}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Image Queue ({imageRuns.length} runs processed)
                                {isSavingRuns && (
                                    <Chip
                                        label="Saving..."
                                        size="small"
                                        sx={{ ml: 1, fontStyle: "italic" }}
                                    />
                                )}
                            </Typography>
                            {imageRuns.length > 0 ? (
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: 1,
                                        maxHeight: "150px",
                                        overflowY: "auto",
                                        p: 1,
                                        border: "1px dashed grey",
                                        borderRadius: 1,
                                    }}
                                >
                                    {imageRuns.map((run, index) => (
                                        <Chip
                                            key={run.runId}
                                            label={`Run ${run.runId}`}
                                            color={
                                                index === currentRunIndex
                                                    ? "primary"
                                                    : "default"
                                            }
                                            variant={
                                                index === currentRunIndex
                                                    ? "filled"
                                                    : "outlined"
                                            }
                                            onClick={() => {
                                                if (
                                                    index !== currentRunIndex &&
                                                    !isConfirming &&
                                                    !isFinalSubmitting
                                                ) {
                                                    setCurrentRunIndex(index);
                                                    setCurrentDetectionMatches(
                                                        {}
                                                    );
                                                    setIsCurrentRunProcessed(
                                                        false
                                                    );
                                                    setError(null);
                                                }
                                            }}
                                            sx={{ cursor: "pointer" }}
                                        />
                                    ))}
                                </Box>
                            ) : (
                                <Typography
                                    color="textSecondary"
                                    sx={{ textAlign: "center", pt: 2, pb: 1 }}
                                >
                                    {isPolling && !error
                                        ? "Polling for new images..."
                                        : hasLoadedInitialSavedRuns
                                        ? "No image runs loaded."
                                        : "Initializing..."}
                                </Typography>
                            )}
                            {(isPolling || !hasLoadedInitialSavedRuns) &&
                                imageRuns.length === 0 &&
                                !error && (
                                    <Box
                                        sx={{
                                            display: "flex",
                                            justifyContent: "center",
                                            mt: 1,
                                        }}
                                    >
                                        <CircularProgress size={24} />
                                    </Box>
                                )}
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Mission Target Status (Confirmed)
                            </Typography>
                            <TableContainer component={Paper}>
                                <Table stickyHeader size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Assignee</TableCell>
                                            <TableCell>
                                                Confirmed Object
                                            </TableCell>
                                            <TableCell>Coords</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {REQUIRED_AIRDROP_INDICES.map(
                                            (index) => {
                                                const d =
                                                    submittedTargets[index];
                                                return (
                                                    <TableRow
                                                        key={index}
                                                        hover
                                                        sx={{
                                                            background:
                                                                d &&
                                                                d.Object !==
                                                                    ODLCObjects.Undefined
                                                                    ? "#e8f5e9"
                                                                    : "inherit",
                                                        }}
                                                    >
                                                        <TableCell>
                                                            {airdropIndexToJSON(
                                                                index
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {d?.Object !==
                                                                undefined &&
                                                            d.Object !==
                                                                ODLCObjects.Undefined ? (
                                                                oDLCObjectsToJSON(
                                                                    d.Object
                                                                )
                                                            ) : (
                                                                <em>Needed</em>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {d?.Coordinate
                                                                ? formatCoordinates(
                                                                      d.Coordinate
                                                                  )
                                                                : "-"}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            }
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            <Divider sx={{ my: 2 }} />
                            <Button
                                variant="contained"
                                color="success"
                                fullWidth
                                onClick={handleFinalSubmit}
                                disabled={
                                    !canSubmitFinalMatches ||
                                    isFinalSubmitting ||
                                    isConfirming
                                }
                                startIcon={
                                    isFinalSubmitting ? (
                                        <CircularProgress
                                            size={20}
                                            color="inherit"
                                        />
                                    ) : null
                                }
                            >
                                {isFinalSubmitting
                                    ? "Submitting..."
                                    : "Send Final Matches"}
                            </Button>
                            {error && isFinalSubmitting && (
                                <Alert
                                    severity="error"
                                    sx={{ mt: 1 }}
                                    onClose={() => setError(null)}
                                >
                                    {error}
                                </Alert>
                            )}
                            {!canSubmitFinalMatches && (
                                <Typography
                                    variant="caption"
                                    display="block"
                                    color="textSecondary"
                                    sx={{ mt: 1, textAlign: "center" }}
                                >
                                    (Requires all 4 targets confirmed with
                                    specific object types)
                                </Typography>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                {/* === Bottom Row: Current Image & Actions === */}
                <Grid item xs={12} md={8}>
                    <Card>
                        <CardContent>
                            <Typography
                                variant="h6"
                                gutterBottom
                                sx={{
                                    mb: 1,
                                    display: "flex",
                                    alignItems: "center",
                                }}
                            >
                                Current Image: Run {currentRun?.runId ?? "N/A"}
                                {isCurrentRunProcessed && !isConfirming && (
                                    <Chip
                                        label="Confirmed"
                                        color="info"
                                        size="small"
                                        sx={{ ml: 1.5 }}
                                    />
                                )}
                            </Typography>
                            <Box
                                ref={imageContainerRef}
                                className="reports-current-image-container"
                                sx={{
                                    position: "relative",
                                    mb: 2,
                                    minHeight: "300px",
                                    background: "#e0e0e0",
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    overflow: "hidden",
                                }}
                            >
                                {currentRun ? (
                                    <>
                                        <img
                                            id="current-target-image"
                                            src={`data:image/png;base64,${currentRun.Picture}`}
                                            alt={`Run ${currentRun.runId}`}
                                            className="reports-current-image"
                                            style={{
                                                display: "block",
                                                maxWidth: "100%",
                                                maxHeight: "70vh",
                                                height: "auto",
                                                objectFit: "contain",
                                            }}
                                            onLoad={() => {
                                                // Force re-calculation of bbox styles if necessary, e.g., by triggering a state update
                                                // that calculateDetectionStyles depends on if it's not already re-running.
                                                // Forcing a re-render of detections could be done by briefly changing currentDetectionMatches
                                                // or adding a dummy state to force re-render of the detection mapping.
                                                // Usually, React handles this if dependencies are correct.
                                                // If styles are off after load, may need to `forceUpdate` or similar.
                                                setCurrentDetectionMatches(
                                                    (prev) => ({ ...prev })
                                                ); // Simple way to trigger re-render of consumers
                                            }}
                                            onError={(e) => {
                                                e.currentTarget.alt = `Error loading image for Run ${currentRun.runId}`;
                                            }}
                                        />
                                        {currentDetections.map(
                                            (detection, index) => {
                                                const {
                                                    bboxStyle,
                                                    labelStyle,
                                                    labelText,
                                                    isValid,
                                                } = calculateDetectionStyles(
                                                    detection,
                                                    index
                                                );
                                                if (!isValid) {
                                                    // console.warn(`Detection ${index} for run ${detection.runId} has invalid scaled bbox.`);
                                                    return null; // Or render a placeholder/error for this specific detection
                                                }
                                                return (
                                                    <React.Fragment
                                                        key={
                                                            detection.compositeKey
                                                        }
                                                    >
                                                        <Box
                                                            style={bboxStyle}
                                                        />
                                                        <Typography
                                                            component="span"
                                                            style={labelStyle}
                                                        >
                                                            {labelText}
                                                        </Typography>
                                                    </React.Fragment>
                                                );
                                            }
                                        )}
                                    </>
                                ) : (
                                    <Typography
                                        color="textSecondary"
                                        sx={{ textAlign: "center", p: 3 }}
                                    >
                                        {imageRuns.length > 0
                                            ? "Loading image..."
                                            : "No images available to display."}
                                    </Typography>
                                )}
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Card>
                        <CardContent className="reports-confirm-actions-content">
                            <Typography variant="h6" gutterBottom>
                                Match Detections
                            </Typography>
                            {currentRun && currentDetections.length > 0 ? (
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 2,
                                    }}
                                >
                                    {currentDetections.map(
                                        (detection, index) => {
                                            const currentMatch =
                                                currentDetectionMatches[
                                                    detection.compositeKey
                                                ];
                                            const assignedAirdropJsonValue =
                                                currentMatch?.airdropIndex !==
                                                    undefined &&
                                                currentMatch.airdropIndex !==
                                                    AirdropIndex.UNRECOGNIZED
                                                    ? airdropIndexToJSON(
                                                          currentMatch.airdropIndex
                                                      )
                                                    : "";
                                            const assignedObjectTypeJsonValue =
                                                currentMatch?.objectType !==
                                                    undefined &&
                                                currentMatch.objectType !==
                                                    ODLCObjects.UNRECOGNIZED
                                                    ? oDLCObjectsToJSON(
                                                          currentMatch.objectType
                                                      )
                                                    : "";
                                            const isDisabled =
                                                isConfirming ||
                                                isFinalSubmitting ||
                                                isCurrentRunProcessed;

                                            return (
                                                <Paper
                                                    key={detection.compositeKey}
                                                    elevation={2}
                                                    sx={{
                                                        p: 1.5,
                                                        opacity: isDisabled
                                                            ? 0.6
                                                            : 1,
                                                        transition:
                                                            "opacity 0.3s ease",
                                                        pointerEvents:
                                                            isDisabled
                                                                ? "none"
                                                                : "auto",
                                                    }}
                                                >
                                                    <Typography
                                                        variant="subtitle1"
                                                        gutterBottom
                                                        sx={{
                                                            display: "flex",
                                                            justifyContent:
                                                                "space-between",
                                                            alignItems:
                                                                "center",
                                                        }}
                                                    >
                                                        {renderTargetLabel(
                                                            index
                                                        )}
                                                        <Typography
                                                            component="span"
                                                            variant="body2"
                                                            color="text.secondary"
                                                        >
                                                            {formatCoordinates(
                                                                detection.coordinate
                                                            )}
                                                        </Typography>
                                                    </Typography>
                                                    {/* Index Select */}
                                                    <FormControl
                                                        fullWidth
                                                        size="small"
                                                        sx={{ mb: 1 }}
                                                        disabled={isDisabled}
                                                    >
                                                        <InputLabel
                                                            id={`a-${detection.compositeKey}`}
                                                        >
                                                            Target Assignee
                                                        </InputLabel>
                                                        <Select
                                                            labelId={`a-${detection.compositeKey}`}
                                                            label="Target Assignee"
                                                            value={
                                                                assignedAirdropJsonValue
                                                            }
                                                            onChange={(e) =>
                                                                handleMatchUpdate(
                                                                    detection.compositeKey,
                                                                    "airdropIndex",
                                                                    e,
                                                                    detection
                                                                )
                                                            }
                                                            displayEmpty
                                                            renderValue={(v) =>
                                                                v || (
                                                                    <em>
                                                                        Assign
                                                                        ID...
                                                                    </em>
                                                                )
                                                            }
                                                        >
                                                            <MenuItem value="">
                                                                <em>
                                                                    Clear
                                                                    Assignment
                                                                </em>
                                                            </MenuItem>
                                                            {REQUIRED_AIRDROP_INDICES.map(
                                                                (idxEnum) => {
                                                                    const v =
                                                                        airdropIndexToJSON(
                                                                            idxEnum
                                                                        );
                                                                    const s =
                                                                        submittedTargets[
                                                                            idxEnum
                                                                        ];
                                                                    const isAlreadyConfirmed =
                                                                        s &&
                                                                        s.Object !==
                                                                            ODLCObjects.Undefined;
                                                                    return (
                                                                        <MenuItem
                                                                            key={
                                                                                v
                                                                            }
                                                                            value={
                                                                                v
                                                                            }
                                                                            sx={{
                                                                                color: isAlreadyConfirmed
                                                                                    ? "text.secondary"
                                                                                    : "inherit",
                                                                            }}
                                                                        >
                                                                            {v}{" "}
                                                                            {isAlreadyConfirmed
                                                                                ? "(Confirmed)"
                                                                                : ""}
                                                                        </MenuItem>
                                                                    );
                                                                }
                                                            )}
                                                        </Select>
                                                        {assignedAirdropJsonValue &&
                                                            submittedTargets[
                                                                airdropIndexFromJSON(
                                                                    assignedAirdropJsonValue
                                                                )
                                                            ] &&
                                                            !isDisabled && (
                                                                <FormHelperText
                                                                    sx={{
                                                                        color: "orange.main",
                                                                    }}
                                                                >
                                                                    Will
                                                                    overwrite
                                                                    previously
                                                                    confirmed
                                                                    selection
                                                                    for this
                                                                    assignee.
                                                                </FormHelperText>
                                                            )}
                                                    </FormControl>
                                                    {/* Object Select */}
                                                    <FormControl
                                                        fullWidth
                                                        size="small"
                                                        sx={{ mb: 1 }}
                                                        disabled={
                                                            isDisabled ||
                                                            !assignedAirdropJsonValue
                                                        }
                                                    >
                                                        <InputLabel
                                                            id={`o-${detection.compositeKey}`}
                                                        >
                                                            Object Type
                                                        </InputLabel>
                                                        <Select
                                                            labelId={`o-${detection.compositeKey}`}
                                                            label="Object Type"
                                                            value={
                                                                assignedObjectTypeJsonValue
                                                            }
                                                            onChange={(e) =>
                                                                handleMatchUpdate(
                                                                    detection.compositeKey,
                                                                    "objectType",
                                                                    e,
                                                                    detection
                                                                )
                                                            }
                                                            displayEmpty
                                                            renderValue={(v) =>
                                                                v || (
                                                                    <em>
                                                                        Select
                                                                        Type...
                                                                    </em>
                                                                )
                                                            }
                                                        >
                                                            <MenuItem value="">
                                                                <em>
                                                                    Undefined
                                                                    (Clear Type)
                                                                </em>
                                                            </MenuItem>
                                                            {Object.entries(
                                                                ODLCObjects
                                                            )
                                                                .filter(
                                                                    ([
                                                                        _,
                                                                        v_enum,
                                                                    ]) =>
                                                                        typeof v_enum ===
                                                                            "number" &&
                                                                        v_enum >
                                                                            0 &&
                                                                        v_enum !==
                                                                            ODLCObjects.UNRECOGNIZED /* Exclude Undefined(0) and UNRECOGNIZED */
                                                                )
                                                                .map(
                                                                    ([
                                                                        k_enum,
                                                                        v_enum,
                                                                    ]) => {
                                                                        const o_json =
                                                                            oDLCObjectsToJSON(
                                                                                v_enum as ODLCObjects
                                                                            );
                                                                        return (
                                                                            <MenuItem
                                                                                key={
                                                                                    k_enum
                                                                                }
                                                                                value={
                                                                                    o_json
                                                                                }
                                                                            >
                                                                                {
                                                                                    o_json
                                                                                }
                                                                            </MenuItem>
                                                                        );
                                                                    }
                                                                )}
                                                        </Select>
                                                    </FormControl>
                                                </Paper>
                                            );
                                        }
                                    )}
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        onClick={handleConfirmLocalMatches}
                                        disabled={
                                            !canConfirmCurrentImage ||
                                            isConfirming ||
                                            isFinalSubmitting ||
                                            isCurrentRunProcessed
                                        }
                                        fullWidth
                                        sx={{ mt: 1 }}
                                        startIcon={
                                            isConfirming ? (
                                                <CircularProgress
                                                    size={20}
                                                    color="inherit"
                                                />
                                            ) : null
                                        }
                                    >
                                        {isCurrentRunProcessed
                                            ? "Matches Confirmed"
                                            : isConfirming
                                            ? "Confirming..."
                                            : "Confirm Image Matches"}
                                    </Button>
                                    {error && isConfirming && (
                                        <Alert
                                            severity="error"
                                            sx={{ mt: 1 }}
                                            onClose={() => setError(null)}
                                        >
                                            {error}
                                        </Alert>
                                    )}
                                    <Button
                                        variant="outlined"
                                        onClick={handleNextImage}
                                        disabled={
                                            isConfirming ||
                                            isFinalSubmitting ||
                                            (currentRunIndex >=
                                                imageRuns.length - 1 &&
                                                !isPolling)
                                        }
                                        fullWidth
                                        sx={{ mt: 1 }}
                                    >
                                        {currentRunIndex >= imageRuns.length - 1
                                            ? isPolling
                                                ? "Waiting for New Images..."
                                                : "End of Queue"
                                            : "Next Image"}
                                    </Button>
                                </Box>
                            ) : (
                                <Typography
                                    color="textSecondary"
                                    sx={{ textAlign: "center", p: 3 }}
                                >
                                    {currentRun
                                        ? "No detections in this image."
                                        : imageRuns.length > 0
                                        ? "Select a run from the queue."
                                        : "No image runs available."}
                                </Typography>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
};

export default Reports;
