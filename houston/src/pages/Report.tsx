// FILE: Report.tsx (Refactored for Undefined=0 and 404 Debugging)

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
    ODLCObjects, // <-- This MUST be from the REGENERATED file
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
const TARGET_MATCHED_ENDPOINT = `${API_BASE_URL}/targets/matched`; // <-- Verify this exact path exists on backend for POST
const REQUIRED_AIRDROP_INDICES = [
    AirdropIndex.Kaz,
    AirdropIndex.Kimi,
    AirdropIndex.Chris,
    AirdropIndex.Daniel,
];
// *** UPDATED: Use the explicit Undefined enum value ***
const PLACEHOLDER_OBJECT_TYPE = ODLCObjects.Undefined;

// --- Mock/Placeholder Data ---
// MOCK_MISSION_ASSIGNMENTS might need updating if it used Mannequin=0 before
// const MOCK_MISSION_ASSIGNMENTS: Airdrop[] = [ ... ];

// --- Helper Functions ---
const fetchTargets = async (): Promise<IdentifiedTarget[]> => {
    // (fetch logic unchanged)
    try {
        const response = await fetch(`${API_BASE_URL}/targets/all`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error("Invalid data format");
        return data.map((item) => IdentifiedTarget.fromJSON(item));
    } catch (error) {
        console.error("Error fetching targets:", error);
        throw error;
    }
};

const postMatchedTargets = async (
    payload: AirdropTarget[]
): Promise<boolean> => {
    // *** Check the URL carefully ***
    console.log(
        `POSTING FINAL MATCHES to ${TARGET_MATCHED_ENDPOINT}:`,
        payload
    );
    const jsonPayload = payload.map((target) => AirdropTarget.toJSON(target));
    try {
        const response = await fetch(TARGET_MATCHED_ENDPOINT, {
            // Use the constant
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(jsonPayload),
        });
        if (!response.ok) {
            // Log more info for 404
            const errorBody = await response.text().catch(() => ""); // Try to get body, default to empty
            console.error(
                `POST to ${TARGET_MATCHED_ENDPOINT} failed with status ${response.status}`,
                errorBody
            );
            // Provide specific error message for 404
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
        throw error; // Rethrow to be handled in handleFinalSubmit
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
    // --- State (declarations unchanged) ---
    const [imageRuns, setImageRuns] = useState<IdentifiedTarget[]>([]);
    const [currentRunIndex, setCurrentRunIndex] = useState<number>(0);
    // const [missionAssignments] = useState<Airdrop[]>(MOCK_MISSION_ASSIGNMENTS);
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

    // Refs
    const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
    const isMountedRef = useRef<boolean>(true);
    const imageContainerRef = useRef<HTMLDivElement>(null);

    // --- Data Processing & Fetching (Callbacks unchanged) ---
    const processFetchedRuns = useCallback(
        /* ...unchanged... */ (fetchedRuns: IdentifiedTarget[]) => {
            let newValidRunsFound = false;
            const newValidRuns = fetchedRuns.filter((run) => {
                if (seenRunIds.has(run.runId)) return false;
                const numCoords = run.coordinates?.length ?? 0;
                const numBBoxes = run.bboxes?.length ?? 0;
                const hasDetections =
                    numCoords > 0 &&
                    numBBoxes > 0 &&
                    Math.min(numCoords, numBBoxes) > 0;
                if (!hasDetections && !seenRunIds.has(run.runId)) {
                    if (isMountedRef.current)
                        setSeenRunIds((prev) => new Set(prev).add(run.runId));
                }
                return hasDetections;
            });
            if (newValidRuns.length > 0) {
                newValidRunsFound = true;
                if (isMountedRef.current) {
                    newValidRuns.sort((a, b) => a.runId - b.runId);
                    setImageRuns((prevRuns) => {
                        const updatedRuns = [...prevRuns, ...newValidRuns];
                        if (prevRuns.length === 0 && updatedRuns.length > 0) {
                            setTimeout(() => {
                                if (isMountedRef.current) setCurrentRunIndex(0);
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
            return newValidRunsFound;
        },
        [seenRunIds]
    );

    const fetchAndProcessLatest = useCallback(
        /* ...unchanged... */ async (isInitialFetch = false) => {
            if (isPolling && !isInitialFetch) return;
            if (!isInitialFetch) setIsPolling(true);
            try {
                const fetched = await fetchTargets();
                if (isMountedRef.current) processFetchedRuns(fetched);
                if (isMountedRef.current) setError(null);
            } catch (
                err: any // eslint-disable-line
            ) {
                if (isMountedRef.current)
                    setError(`Fetch failed: ${err.message}`);
            } finally {
                if (isMountedRef.current && !isInitialFetch)
                    setIsPolling(false);
            }
        },
        [processFetchedRuns, isPolling]
    );

    // --- Effects (unchanged) ---
    useEffect(() => {
        isMountedRef.current = true;
        fetchAndProcessLatest(true);
        intervalIdRef.current = setInterval(
            () => fetchAndProcessLatest(false),
            POLLING_INTERVAL_MS
        );
        return () => {
            isMountedRef.current = false;
            if (intervalIdRef.current) clearInterval(intervalIdRef.current);
        };
    }, [fetchAndProcessLatest]);

    // --- Memoized Derived State ---
    const currentRun = useMemo(
        /* ...unchanged... */ () =>
            imageRuns.length > 0 &&
            currentRunIndex >= 0 &&
            currentRunIndex < imageRuns.length
                ? imageRuns[currentRunIndex]
                : null,
        [imageRuns, currentRunIndex]
    );
    const currentDetections = useMemo(
        /* ...unchanged... */ (): DetectionInfo[] => {
            if (!currentRun) return [];
            const detections: DetectionInfo[] = [];
            const coords = currentRun.coordinates ?? [];
            const bboxes = currentRun.bboxes ?? [];
            const numDetections = Math.min(coords.length, bboxes.length);
            if (coords.length !== bboxes.length && numDetections > 0)
                console.warn(`Run ${currentRun.runId}: Coord/Bbox mismatch`);
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
        },
        [currentRun]
    );

    // Can confirm if >= 1 valid match exists in current selections
    const canConfirmCurrentImage = useMemo(() => {
        return Object.values(currentDetectionMatches).some(
            (match) =>
                match &&
                match.airdropIndex !== undefined &&
                match.airdropIndex !== AirdropIndex.UNRECOGNIZED &&
                match.objectType !== undefined &&
                match.objectType !== ODLCObjects.UNRECOGNIZED &&
                match.objectType !== PLACEHOLDER_OBJECT_TYPE // Check against Undefined
        );
    }, [currentDetectionMatches]);

    // Can submit final if all required targets are confirmed
    const canSubmitFinalMatches = useMemo(() => {
        return REQUIRED_AIRDROP_INDICES.every(
            (index) =>
                submittedTargets[index] !== undefined &&
                submittedTargets[index]?.Object !== ODLCObjects.Undefined // Also ensure object isn't Undefined in submitted
        );
    }, [submittedTargets]);

    // --- Event Handlers ---

    // Update current image selections
    const handleMatchUpdate = (
        compositeKey: string,
        field: "airdropIndex" | "objectType",
        event: SelectChangeEvent<string | number>,
        detectionInfo: DetectionInfo
    ) => {
        const selectedJsonValue = event.target.value;
        let selectedEnumValue: AirdropIndex | ODLCObjects | undefined | "" = "";

        // Convert and validate enum
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
                    console.warn("Invalid enum value");
                    return;
                }
            } catch (e) {
                console.error("Enum conversion error", e);
                return;
            }
        }

        setCurrentDetectionMatches((prev) => {
            const updatedMatches = { ...prev };
            const currentMatchData = updatedMatches[compositeKey];
            // *** UPDATED: Default object type is now Undefined ***
            const defaultObjectType = ODLCObjects.Undefined;

            let newMatch: CurrentDetectionMatch | undefined = undefined;

            if (field === "airdropIndex") {
                if (selectedEnumValue === "") {
                    delete updatedMatches[compositeKey];
                    return updatedMatches;
                } else if (
                    typeof selectedEnumValue === "number" &&
                    selectedEnumValue in AirdropIndex
                ) {
                    const newAirdropIndex = selectedEnumValue as AirdropIndex;
                    // Allow re-selection locally, confirmation handles overwrites
                    newMatch = {
                        airdropIndex: newAirdropIndex,
                        // If creating new, set type to Undefined, else keep existing
                        objectType:
                            currentMatchData?.objectType ?? defaultObjectType,
                        detectionInfo: detectionInfo,
                    };
                }
            } else {
                // objectType
                if (selectedEnumValue === "") {
                    // *** UPDATED: Set to Undefined when clearing ***
                    if (currentMatchData)
                        newMatch = {
                            ...currentMatchData,
                            objectType: ODLCObjects.Undefined,
                        };
                    else
                        console.warn(
                            "Cannot clear objectType, no index assigned."
                        );
                } else if (
                    typeof selectedEnumValue === "number" &&
                    selectedEnumValue in ODLCObjects
                ) {
                    const newObjectType = selectedEnumValue as ODLCObjects;
                    if (currentMatchData)
                        newMatch = {
                            ...currentMatchData,
                            objectType: newObjectType,
                        };
                    else
                        console.warn(
                            "Cannot set objectType, no index assigned."
                        );
                }
            }

            if (newMatch) updatedMatches[compositeKey] = newMatch;
            else if (field !== "airdropIndex") return prev; // Avoid update if object change invalid

            return updatedMatches;
        });
        if (isCurrentRunProcessed) setIsCurrentRunProcessed(false); // Reset processed status on change
    };

    // Confirm matches for the current image locally
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
                // *** UPDATED: Check against Undefined ***
                match.objectType !== PLACEHOLDER_OBJECT_TYPE &&
                match.detectionInfo
            ) {
                if (submittedTargets[match.airdropIndex]) {
                    overwriteCount++;
                    // Optional: Add confirmation dialog for overwrite
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
        // Decide whether to clear currentDetectionMatches or not here
        setIsConfirming(false);
        // Optionally move next: handleNextImage();
    };

    // Submit final confirmed matches to backend
    const handleFinalSubmit = async () => {
        if (!canSubmitFinalMatches || isFinalSubmitting) return;
        setIsFinalSubmitting(true);
        setError(null);

        // *** UPDATED: Ensure submitted targets don't have Undefined object type ***
        const finalPayload = Object.values(submittedTargets).filter(
            (target): target is AirdropTarget =>
                target !== undefined && target.Object !== ODLCObjects.Undefined
        );

        if (finalPayload.length !== REQUIRED_AIRDROP_INDICES.length) {
            console.error(
                "Final submit: Payload incomplete or contains Undefined objects."
            );
            setError("Internal error: Incomplete final target list.");
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
            }
            // Error handled by catch
        } catch (
            postError: any // eslint-disable-line
        ) {
            console.error("Final submission failed:", postError);
            if (isMountedRef.current) {
                // Display the specific error from postMatchedTargets (includes 404 details)
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

    // Other handlers (handleNextImage, handleSnackbarClose) unchanged
    const handleNextImage = () => {
        /* ...unchanged... */ if (
            !isMountedRef.current ||
            isConfirming ||
            isFinalSubmitting
        )
            return;
        if (currentRunIndex < imageRuns.length - 1) {
            const nextIndex = currentRunIndex + 1;
            setCurrentRunIndex(nextIndex);
            setCurrentDetectionMatches({});
            setIsCurrentRunProcessed(false);
            setError(null);
        } else {
            if (!isPolling) alert("End of loaded images.");
        }
    };
    const handleSnackbarClose = () => {
        /* ...unchanged... */ setSnackbarOpen(false);
    };

    // --- Rendering Helpers (formatCoordinates, renderTargetLabel, calculateDetectionStyles unchanged) ---
    const formatCoordinates = (coord: GPSCoord | undefined): string => {
        /* ...unchanged... */ if (!coord) return "N/A";
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
    const renderTargetLabel = (index: number): string => {
        /* ...unchanged... */ return `Detection ${String.fromCharCode(
            65 + index
        )}`;
    };
    const calculateDetectionStyles = (
        detection: DetectionInfo,
        index: number
    ): {
        bboxStyle: React.CSSProperties;
        labelStyle: React.CSSProperties;
        labelText: string;
        isValid: boolean;
    } => {
        /* ...unchanged from previous fix... */ const defaultStyles = {
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
        )
            return defaultStyles;
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
        const x1_raw: number = x1 ?? 0;
        const y1_raw: number = y1 ?? 0;
        const x2_raw: number = x2 ?? x1_raw;
        const y2_raw: number = y2 ?? y1_raw;
        const scaledX1 = offsetX + x1_raw * scale;
        const scaledY1 = offsetY + y1_raw * scale;
        const scaledWidth = Math.max(0, (x2_raw - x1_raw) * scale);
        const scaledHeight = Math.max(0, (y2_raw - y1_raw) * scale);
        const isValid = scaledWidth > 0 && scaledHeight > 0;
        if (!isValid) return defaultStyles;
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
            {/* Global Error Alert */}
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
                autoHideDuration={6000}
                onClose={handleSnackbarClose}
                message={snackbarMessage}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            />

            <Grid container spacing={2}>
                {/* === Top Row: Queue & Status === */}
                <Grid item xs={12} md={8}>
                    {/* Image Queue (UI unchanged) */}
                    <Card>
                        <CardContent>
                            {" "}
                            <Typography variant="h6" gutterBottom>
                                Image Queue ({imageRuns.length} runs)
                            </Typography>{" "}
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
                                    {" "}
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
                                    ))}{" "}
                                </Box>
                            ) : (
                                <Typography
                                    color="textSecondary"
                                    sx={{ textAlign: "center", pt: 2, pb: 1 }}
                                >
                                    {isPolling ? "Polling..." : "No runs."}
                                </Typography>
                            )}{" "}
                            {isPolling && !error && imageRuns.length === 0 && (
                                <Box
                                    sx={{
                                        display: "flex",
                                        justifyContent: "center",
                                        mt: 1,
                                    }}
                                >
                                    <CircularProgress size={24} />
                                </Box>
                            )}{" "}
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                    {/* Mission Status Table (Shows Confirmed) */}
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Mission Target Status (Confirmed)
                            </Typography>
                            <TableContainer component={Paper}>
                                {" "}
                                <Table stickyHeader size="small">
                                    {" "}
                                    <TableHead>
                                        {" "}
                                        <TableRow>
                                            <TableCell>Assignee</TableCell>
                                            <TableCell>
                                                Confirmed Object
                                            </TableCell>
                                            <TableCell>Coords</TableCell>
                                        </TableRow>{" "}
                                    </TableHead>{" "}
                                    <TableBody>
                                        {" "}
                                        {REQUIRED_AIRDROP_INDICES.map(
                                            (index) => {
                                                const d =
                                                    submittedTargets[index];
                                                return (
                                                    <TableRow
                                                        key={index}
                                                        hover
                                                        sx={{
                                                            background: d
                                                                ? "#e8f5e9"
                                                                : "inherit",
                                                        }}
                                                    >
                                                        {" "}
                                                        <TableCell>
                                                            {airdropIndexToJSON(
                                                                index
                                                            )}
                                                        </TableCell>{" "}
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
                                                        </TableCell>{" "}
                                                        <TableCell>
                                                            {d?.Coordinate
                                                                ? formatCoordinates(
                                                                      d.Coordinate
                                                                  )
                                                                : "-"}
                                                        </TableCell>{" "}
                                                    </TableRow>
                                                );
                                            }
                                        )}{" "}
                                    </TableBody>{" "}
                                </Table>{" "}
                            </TableContainer>
                            {/* Final Submit Button */}
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
                                {" "}
                                {isFinalSubmitting
                                    ? "Submitting..."
                                    : "Send Final Matches"}{" "}
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
                                    (Requires all 4 targets confirmed)
                                </Typography>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                {/* === Bottom Row: Current Image & Actions === */}
                <Grid item xs={12} md={8}>
                    {/* Current Image Display */}
                    <Card>
                        {" "}
                        <CardContent>
                            {" "}
                            <Typography
                                variant="h6"
                                gutterBottom
                                sx={{
                                    mb: 1,
                                    display: "flex",
                                    alignItems: "center",
                                }}
                            >
                                {" "}
                                Current Image: Run {currentRun?.runId ??
                                    "N/A"}{" "}
                                {isCurrentRunProcessed && !isConfirming && (
                                    <Chip
                                        label="Confirmed"
                                        color="info"
                                        size="small"
                                        sx={{ ml: 1.5 }}
                                    />
                                )}{" "}
                            </Typography>{" "}
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
                                {" "}
                                {currentRun ? (
                                    <>
                                        {" "}
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
                                            onLoad={() =>
                                                setCurrentDetectionMatches(
                                                    (prev) => ({ ...prev })
                                                )
                                            }
                                            onError={(e) => {
                                                e.currentTarget.alt = `Error load ${currentRun.runId}`;
                                            }}
                                        />{" "}
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
                                                if (!isValid) return null;
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
                                        )}{" "}
                                    </>
                                ) : (
                                    <Typography
                                        color="textSecondary"
                                        sx={{ textAlign: "center", p: 3 }}
                                    >
                                        {imageRuns.length > 0
                                            ? "Loading..."
                                            : "No images."}
                                    </Typography>
                                )}{" "}
                            </Box>{" "}
                        </CardContent>{" "}
                    </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                    {/* Match Detections Actions */}
                    <Card>
                        {" "}
                        <CardContent className="reports-confirm-actions-content">
                            {" "}
                            <Typography variant="h6" gutterBottom>
                                Match Detections
                            </Typography>{" "}
                            {currentRun && currentDetections.length > 0 ? (
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 2,
                                    }}
                                >
                                    {" "}
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
                                                    {" "}
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
                                                        {" "}
                                                        {renderTargetLabel(
                                                            index
                                                        )}{" "}
                                                        <Typography
                                                            component="span"
                                                            variant="body2"
                                                            color="text.secondary"
                                                        >
                                                            {formatCoordinates(
                                                                detection.coordinate
                                                            )}
                                                        </Typography>{" "}
                                                    </Typography>{" "}
                                                    {/* Index Select */}{" "}
                                                    <FormControl
                                                        fullWidth
                                                        size="small"
                                                        sx={{ mb: 1 }}
                                                        disabled={isDisabled}
                                                    >
                                                        {" "}
                                                        <InputLabel
                                                            id={`a-${detection.compositeKey}`}
                                                        >
                                                            Target
                                                        </InputLabel>{" "}
                                                        <Select
                                                            labelId={`a-${detection.compositeKey}`}
                                                            label="Target"
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
                                                            {" "}
                                                            <MenuItem value="">
                                                                <em>Clear</em>
                                                            </MenuItem>{" "}
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
                                                                    return (
                                                                        <MenuItem
                                                                            key={
                                                                                v
                                                                            }
                                                                            value={
                                                                                v
                                                                            }
                                                                            sx={{
                                                                                color: s
                                                                                    ? "text.secondary"
                                                                                    : "inherit",
                                                                            }}
                                                                        >
                                                                            {v}{" "}
                                                                            {s
                                                                                ? "(Conf.)"
                                                                                : ""}
                                                                        </MenuItem>
                                                                    );
                                                                }
                                                            )}{" "}
                                                        </Select>{" "}
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
                                                                    confirmed.
                                                                </FormHelperText>
                                                            )}{" "}
                                                    </FormControl>{" "}
                                                    {/* Object Select */}{" "}
                                                    <FormControl
                                                        fullWidth
                                                        size="small"
                                                        sx={{ mb: 1 }}
                                                        disabled={
                                                            isDisabled ||
                                                            !assignedAirdropJsonValue
                                                        }
                                                    >
                                                        {" "}
                                                        <InputLabel
                                                            id={`o-${detection.compositeKey}`}
                                                        >
                                                            Object
                                                        </InputLabel>{" "}
                                                        <Select
                                                            labelId={`o-${detection.compositeKey}`}
                                                            label="Object"
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
                                                            {" "}
                                                            <MenuItem value="">
                                                                <em>
                                                                    Undefined
                                                                </em>
                                                            </MenuItem>{" "}
                                                            {Object.entries(
                                                                ODLCObjects
                                                            )
                                                                .filter(
                                                                    ([_, v]) =>
                                                                        typeof v ===
                                                                            "number" &&
                                                                        v > 0 &&
                                                                        v !==
                                                                            ODLCObjects.UNRECOGNIZED /* Exclude Undefined(0) */
                                                                )
                                                                .map(
                                                                    ([
                                                                        k,
                                                                        v,
                                                                    ]) => {
                                                                        const o =
                                                                            oDLCObjectsToJSON(
                                                                                v as ODLCObjects
                                                                            );
                                                                        return (
                                                                            <MenuItem
                                                                                key={
                                                                                    k
                                                                                }
                                                                                value={
                                                                                    o
                                                                                }
                                                                            >
                                                                                {
                                                                                    o
                                                                                }
                                                                            </MenuItem>
                                                                        );
                                                                    }
                                                                )}{" "}
                                                        </Select>{" "}
                                                        {/* Helper for Undefined removed as it's now an explicit option */}{" "}
                                                    </FormControl>{" "}
                                                </Paper>
                                            );
                                        }
                                    )}{" "}
                                    {/* Confirm Button */}{" "}
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
                                        {" "}
                                        {isCurrentRunProcessed
                                            ? "Confirmed"
                                            : isConfirming
                                            ? "Confirming..."
                                            : "Confirm Image Matches"}{" "}
                                    </Button>{" "}
                                    {error && isConfirming && (
                                        <Alert
                                            severity="error"
                                            sx={{ mt: 1 }}
                                            onClose={() => setError(null)}
                                        >
                                            {error}
                                        </Alert>
                                    )}{" "}
                                    {/* Next Button */}{" "}
                                    <Button
                                        variant="outlined"
                                        onClick={handleNextImage}
                                        disabled={
                                            currentRunIndex >=
                                                imageRuns.length - 1 ||
                                            isConfirming ||
                                            isFinalSubmitting
                                        }
                                        fullWidth
                                        sx={{ mt: 1 }}
                                    >
                                        {" "}
                                        {currentRunIndex >= imageRuns.length - 1
                                            ? isPolling
                                                ? "Waiting..."
                                                : "End"
                                            : "Next Image"}{" "}
                                    </Button>{" "}
                                </Box>
                            ) : (
                                <Typography
                                    color="textSecondary"
                                    sx={{ textAlign: "center", p: 3 }}
                                >
                                    {currentRun
                                        ? "No detections."
                                        : "Select run."}
                                </Typography>
                            )}{" "}
                        </CardContent>{" "}
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
};

export default Reports;
