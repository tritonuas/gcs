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
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
// import CancelIcon from "@mui/icons-material/Cancel"; // No longer needed for reject
import PhotoSizeSelectActualIcon from "@mui/icons-material/PhotoSizeSelectActual";

import {
    IdentifiedTarget,
    Airdrop,
    AirdropIndex,
    ODLCObjects,
    airdropIndexToJSON,
    oDLCObjectsToJSON,
    oDLCObjectsFromJSON, // Needed for select -> enum
    airdropIndexFromJSON, // Needed for select -> enum
    GPSCoord,
    BboxProto,
    AirdropTarget, // Import the message type for the POST payload
} from "../protos/obc.pb"; // Adjust path as needed

import "./Report.css";

// --- Constants ---
const POLLING_INTERVAL_MS = 10000; // 10 seconds
const API_BASE_URL = "/api";
const REQUIRED_AIRDROP_INDICES = [
    AirdropIndex.Kaz,
    AirdropIndex.Kimi,
    AirdropIndex.Chris,
    AirdropIndex.Daniel,
];

// --- Mock/Placeholder Data ---
// TODO: Fetch this from /api/mission or have it configured
const MOCK_MISSION_ASSIGNMENTS: Airdrop[] = [
    { Index: AirdropIndex.Kaz, Object: ODLCObjects.Airplane },
    { Index: AirdropIndex.Kimi, Object: ODLCObjects.Bus },
    { Index: AirdropIndex.Chris, Object: ODLCObjects.Boat },
    { Index: AirdropIndex.Daniel, Object: ODLCObjects.Suitcase },
];

// --- Helper Functions ---

/** Fetches all available image runs from the backend */
const fetchTargets = async (): Promise<IdentifiedTarget[]> => {
    try {
        const response = await fetch(`${API_BASE_URL}/targets/all`);
        if (!response.ok) {
            throw new Error(
                `HTTP error! status: ${response.status} ${response.statusText}`
            );
        }
        const data = await response.json(); // Expects an array of JSON objects

        if (!Array.isArray(data)) {
            console.error(
                "Received non-array data from /api/targets/all:",
                data
            );
            throw new Error("Invalid data format received from server.");
        }
        // Use IdentifiedTarget.fromJSON to convert plain JS objects to protobuf message instances
        return data.map((item) => IdentifiedTarget.fromJSON(item));
    } catch (error) {
        console.error("Error fetching targets:", error);
        throw error; // Re-throw to be caught by caller
    }
};

/** Posts the matched targets for a completed image run */
const postMatchedTargets = async (
    payload: AirdropTarget[]
): Promise<boolean> => {
    console.log("Sending matches to /api/targets/matched:", payload);
    // Convert protobuf instances to plain JSON for the request body
    const jsonPayload = payload.map((target) => AirdropTarget.toJSON(target));

    try {
        const response = await fetch(`${API_BASE_URL}/targets/matched`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(jsonPayload), // Send array of JSON objects
        });
        if (!response.ok) {
            const errorBody = await response.text();
            console.error(
                "POST /api/targets/matched failed:",
                response.status,
                errorBody
            );
            throw new Error(
                `HTTP error! status: ${response.status} - ${errorBody}`
            );
        }
        console.log("POST /api/targets/matched successful:", jsonPayload);
        return true;
    } catch (error) {
        console.error("Error posting matched targets:", error);
        return false;
    }
};

/** Interface representing a single detection within an Image Run */
interface DetectionInfo {
    runId: number;
    detectionIndex: number; // Index within the coordinates/bboxes arrays (0=A, 1=B, ...)
    compositeKey: string; // Unique key for React state: ${runId}-${detectionIndex}
    coordinate: GPSCoord;
    bbox: BboxProto;
}

/** Interface for storing the user's match for a detection in the current image */
interface DetectionMatch {
    airdropIndex: AirdropIndex;
    objectType: ODLCObjects;
}

// --- Component ---

const Reports: React.FC = () => {
    const [imageRuns, setImageRuns] = useState<IdentifiedTarget[]>([]);
    const [currentRunIndex, setCurrentRunIndex] = useState<number>(0);
    const [missionAssignments] = useState<Airdrop[]>(MOCK_MISSION_ASSIGNMENTS);
    const [seenRunIds, setSeenRunIds] = useState<Set<number>>(new Set());

    // Stores the assigned AirdropIndex + ODLCObject for each *detection* (A, B, C...) in the *current run*
    // Key: compositeKey (`${runId}-${detectionIndex}`)
    // Value: { airdropIndex: AirdropIndex, objectType: ODLCObjects } or undefined
    const [currentDetectionMatches, setCurrentDetectionMatches] = useState<{
        [compositeKey: string]: DetectionMatch | undefined;
    }>({});

    // Tracks submission status for the current image to prevent double submissions
    const [isCurrentRunSubmitted, setIsCurrentRunSubmitted] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [isPolling, setIsPolling] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false); // For submit button loading state

    const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
    const isMountedRef = useRef<boolean>(true);

    // --- Data Processing & Fetching (Mostly Unchanged) ---
    const processFetchedRuns = useCallback(
        (fetchedRuns: IdentifiedTarget[]) => {
            // ... (keep existing logic) ...
            let newRunsFound = false;
            const newRuns = fetchedRuns.filter(
                (run) => !seenRunIds.has(run.runId)
            );

            if (newRuns.length > 0) {
                newRunsFound = true;
                console.log(`Processing ${newRuns.length} new image runs.`);
                if (isMountedRef.current) {
                    setImageRuns((prevRuns) => [...prevRuns, ...newRuns]);
                    setSeenRunIds((prevIds) => {
                        const updatedIds = new Set(prevIds);
                        newRuns.forEach((run) => updatedIds.add(run.runId));
                        return updatedIds;
                    });
                }
            }
            return newRunsFound;
        },
        [seenRunIds]
    );

    const fetchAndProcessLatest = useCallback(
        async (isInitialFetch = false) => {
            // ... (keep existing logic) ...
            if (isPolling && !isInitialFetch) return;
            if (!isInitialFetch) setIsPolling(true);
            try {
                const fetchedRuns = await fetchTargets();
                if (isMountedRef.current) {
                    processFetchedRuns(fetchedRuns);
                    if (isInitialFetch && fetchedRuns.length === 0) {
                        console.log("Initial fetch returned no image runs.");
                    }
                    setError(null);
                }
            } catch (err: any) {
                console.error(
                    `Error during ${
                        isInitialFetch ? "initial fetch" : "poll"
                    }:`,
                    err
                );
                if (isInitialFetch && isMountedRef.current) {
                    setError(
                        `Failed initial load: ${err.message}. Will poll for updates.`
                    );
                }
            } finally {
                if (isMountedRef.current) {
                    if (!isInitialFetch) setIsPolling(false);
                }
            }
        },
        [processFetchedRuns, isPolling]
    );

    // --- Effects (Mostly Unchanged) ---
    useEffect(() => {
        isMountedRef.current = true;
        fetchAndProcessLatest(true); // Initial fetch
        intervalIdRef.current = setInterval(() => {
            fetchAndProcessLatest(false); // Polling fetch
        }, POLLING_INTERVAL_MS);
        return () => {
            // Cleanup
            isMountedRef.current = false;
            if (intervalIdRef.current) {
                clearInterval(intervalIdRef.current);
                console.log("Cleared target polling interval.");
            }
        };
    }, [fetchAndProcessLatest]);

    // --- Memoized Current Run and Detections (Unchanged) ---
    const currentRun = useMemo(() => {
        if (imageRuns.length > 0 && currentRunIndex < imageRuns.length) {
            return imageRuns[currentRunIndex];
        }
        return null;
    }, [imageRuns, currentRunIndex]);

    const currentDetections = useMemo((): DetectionInfo[] => {
        if (!currentRun) return [];
        // ... (keep existing logic to create DetectionInfo array) ...
        const detections: DetectionInfo[] = [];
        const numCoords = currentRun.coordinates?.length ?? 0;
        const numBBoxes = currentRun.bboxes?.length ?? 0;
        if (numCoords !== numBBoxes) {
            console.warn(
                `Run ID ${currentRun.runId}: Mismatch between coordinates (${numCoords}) and bboxes (${numBBoxes}).`
            );
        }
        const numDetections = Math.min(numCoords, numBBoxes);
        for (let i = 0; i < numDetections; i++) {
            if (currentRun.coordinates[i] && currentRun.bboxes[i]) {
                detections.push({
                    runId: currentRun.runId,
                    detectionIndex: i,
                    compositeKey: `${currentRun.runId}-${i}`,
                    coordinate: currentRun.coordinates[i],
                    bbox: currentRun.bboxes[i],
                });
            } else {
                console.warn(
                    `Run ID ${currentRun.runId}: Missing coordinate or bbox at index ${i}. Skipping detection.`
                );
            }
        }
        return detections;
    }, [currentRun]);

    // --- New State Calculation: Check if all required targets are matched in the current image ---
    const isCurrentRunFullyMatched = useMemo(() => {
        if (!currentRun || currentDetections.length === 0) return false;

        const assignedAirdropIndices = new Set<AirdropIndex>();
        Object.values(currentDetectionMatches).forEach((match) => {
            if (match) {
                assignedAirdropIndices.add(match.airdropIndex);
            }
        });

        return REQUIRED_AIRDROP_INDICES.every((reqIndex) =>
            assignedAirdropIndices.has(reqIndex)
        );
    }, [currentDetectionMatches, currentRun, currentDetections]);

    // --- Event Handlers ---

    const handleMatchUpdate = (
        compositeKey: string,
        field: "airdropIndex" | "objectType",
        event: SelectChangeEvent<string | number> // Value is JSON representation
    ) => {
        const selectedJsonValue = event.target.value;
        let selectedEnumValue: AirdropIndex | ODLCObjects | undefined | "" = ""; // Allow empty string for clearing

        if (selectedJsonValue === "") {
            // Clearing the selection for this field
            selectedEnumValue = "";
        } else if (field === "airdropIndex") {
            // Note: Protobuf-ts uses enum names as keys in JSON by default
            // Adjust if your backend sends/expects numeric values
            selectedEnumValue = airdropIndexFromJSON(selectedJsonValue);
        } else {
            // objectType
            selectedEnumValue = oDLCObjectsFromJSON(selectedJsonValue);
        }

        setCurrentDetectionMatches((prev) => {
            const updatedMatches = { ...prev };
            const currentMatch = updatedMatches[compositeKey] ?? {
                // Provide default valid enums if creating new
                airdropIndex: AirdropIndex.Kaz, // Or some default/unspecified
                objectType: ODLCObjects.Mannequin, // Or some default/unspecified
            };
            let newMatch: DetectionMatch | undefined = undefined;

            if (field === "airdropIndex") {
                if (selectedEnumValue === "") {
                    // If clearing AirdropIndex, clear the whole match for this detection?
                    // Or just set airdropIndex to undefined/default? Let's clear whole match.
                    delete updatedMatches[compositeKey];
                    return updatedMatches;
                } else if (
                    typeof selectedEnumValue === "number" &&
                    selectedEnumValue in AirdropIndex
                ) {
                    const newAirdropIndex = selectedEnumValue as AirdropIndex;
                    // --- Validation: Check if this AirdropIndex is already assigned to ANOTHER detection in THIS run ---
                    const isAlreadyAssigned = Object.entries(prev).some(
                        ([key, existingMatch]) =>
                            key !== compositeKey && // Not the current detection
                            existingMatch?.airdropIndex === newAirdropIndex
                    );
                    if (isAlreadyAssigned) {
                        alert(
                            `${airdropIndexToJSON(
                                newAirdropIndex
                            )} is already assigned to another target in this image.`
                        );
                        return prev; // Don't update state
                    }
                    // --- End Validation ---
                    newMatch = {
                        ...currentMatch,
                        airdropIndex: newAirdropIndex,
                    };
                }
            } else {
                // objectType
                if (selectedEnumValue === "") {
                    // If clearing objectType, maybe reset to a default or clear the match?
                    // Let's assume clearing objectType means the match is incomplete, but keep AirdropIndex if set
                    // This requires objectType to be potentially undefined or have a default 'unselected' state
                    // For simplicity now, let's prevent clearing type if index is set? Or allow it?
                    // Allow it for now, but the submit logic needs objectType.
                    if (updatedMatches[compositeKey]) {
                        // How to handle partial match? Maybe require both or neither?
                        // Let's just update the type for now. Validation on submit handles missing types.
                        const newObjectType = ODLCObjects.Mannequin; // Or better: introduce an UNKNOWN/UNSELECTED type
                        newMatch = {
                            ...currentMatch,
                            objectType: newObjectType,
                        };
                    } else {
                        // No existing match, clearing type doesn't make sense
                        return prev;
                    }
                } else if (
                    typeof selectedEnumValue === "number" &&
                    selectedEnumValue in ODLCObjects
                ) {
                    const newObjectType = selectedEnumValue as ODLCObjects;
                    newMatch = { ...currentMatch, objectType: newObjectType };
                }
            }

            if (newMatch) {
                updatedMatches[compositeKey] = newMatch;
            }

            return updatedMatches;
        });
    };

    const handleSubmitMatches = async () => {
        if (
            !currentRun ||
            !isCurrentRunFullyMatched ||
            isSubmitting ||
            isCurrentRunSubmitted
        ) {
            console.warn("Submit called but conditions not met.");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        const payload: AirdropTarget[] = [];
        let success = true;

        // Map from AirdropIndex to the compositeKey of the detection it was assigned to
        const indexToDetectionKeyMap = new Map<AirdropIndex, string>();
        Object.entries(currentDetectionMatches).forEach(([key, match]) => {
            if (match) {
                indexToDetectionKeyMap.set(match.airdropIndex, key);
            }
        });

        for (const requiredIndex of REQUIRED_AIRDROP_INDICES) {
            const compositeKey = indexToDetectionKeyMap.get(requiredIndex);
            const matchData = compositeKey
                ? currentDetectionMatches[compositeKey]
                : undefined;
            const detectionIndex = compositeKey
                ? parseInt(compositeKey.split("-")[1], 10)
                : -1;

            if (
                !matchData ||
                detectionIndex < 0 ||
                detectionIndex >= currentRun.coordinates.length
            ) {
                console.error(
                    `Data missing or inconsistent for required target ${airdropIndexToJSON(
                        requiredIndex
                    )}`
                );
                setError(
                    `Error: Data missing or inconsistent for required target ${airdropIndexToJSON(
                        requiredIndex
                    )}. Cannot submit.`
                );
                success = false;
                break; // Stop processing
            }

            const coordinate = currentRun.coordinates[detectionIndex];
            if (!coordinate) {
                console.error(
                    `Coordinate missing for detection index ${detectionIndex}`
                );
                setError(
                    `Error: Coordinate missing for detection index ${detectionIndex}. Cannot submit.`
                );
                success = false;
                break; // Stop processing
            }

            // Ensure ObjectType is valid (not default/unselected if you add one)
            if (
                matchData.objectType ===
                undefined /* || matchData.objectType === ODLCObjects.UNSELECTED */
            ) {
                console.error(
                    `Object type not selected for target ${airdropIndexToJSON(
                        requiredIndex
                    )}`
                );
                setError(
                    `Error: Object type not selected for target ${airdropIndexToJSON(
                        requiredIndex
                    )}. Cannot submit.`
                );
                success = false;
                break; // Stop processing
            }

            payload.push(
                AirdropTarget.create({
                    Index: requiredIndex,
                    Coordinate: coordinate,
                    Object: matchData.objectType,
                })
            );
        }

        if (success && payload.length === REQUIRED_AIRDROP_INDICES.length) {
            const postSuccess = await postMatchedTargets(payload);
            if (postSuccess) {
                console.log(
                    `Successfully submitted matches for run ${currentRun.runId}`
                );
                setIsCurrentRunSubmitted(true); // Mark as submitted
                // Optionally move to next image automatically
                // handleNextImage();
            } else {
                setError(
                    "Failed to submit matches to the backend. Check console."
                );
                // Keep UI state as is to allow retry? Or clear submission status?
                success = false;
            }
        } else if (success) {
            // This case should ideally not be reached if isCurrentRunFullyMatched is correct
            console.error("Mismatch in payload length despite passing checks.");
            setError("Internal error preparing submission data.");
            success = false;
        }

        setIsSubmitting(false);
        if (success && payload.length === REQUIRED_AIRDROP_INDICES.length) {
            // Consider moving to next image only on full success
            handleNextImage();
        }
    };

    const handleNextImage = () => {
        if (currentRunIndex < imageRuns.length - 1) {
            setCurrentRunIndex((prev) => prev + 1);
            // Reset local states for the new image run's detections
            setCurrentDetectionMatches({});
            setIsCurrentRunSubmitted(false); // Reset submission status for the new image
            setError(null); // Clear errors from previous image
        } else {
            alert(
                "You have reviewed all currently loaded images. Waiting for new images..."
            );
        }
    };

    // --- Rendering Helpers ---
    const formatCoordinates = (coord: GPSCoord | undefined): string => {
        if (!coord) return "N/A";
        const lat = coord.Latitude?.toFixed(5) ?? "N/A";
        const lon = coord.Longitude?.toFixed(5) ?? "N/A";
        return `(${lat}, ${lon})`;
    };

    const renderTargetLabel = (index: number): string => {
        return `Detection ${String.fromCharCode(65 + index)}`; // A, B, C...
    };

    // Calculate BBox styles (Unchanged)
    const calculateDetectionStyles = (
        detection: DetectionInfo,
        index: number
    ) => {
        // ... (keep existing Bbox calculation logic) ...
        // Use currentDetectionMatches to potentially color based on assignment? (Optional)
        const match = currentDetectionMatches[detection.compositeKey];
        const color = match ? "lime" : "cyan"; // Simple example: green if assigned anything

        const imgElement = document.getElementById("current-target-image");
        const displayWidth = imgElement?.offsetWidth ?? 1;
        const naturalWidth =
            imgElement instanceof HTMLImageElement
                ? imgElement.naturalWidth
                : displayWidth;
        const scaleFactor = naturalWidth > 0 ? displayWidth / naturalWidth : 1;
        const {
            x1: x1_raw,
            y1: y1_raw,
            x2: x2_raw,
            y2: y2_raw,
        } = detection.bbox;
        const x1_safe = x1_raw ?? 0;
        const y1_safe = y1_raw ?? 0;
        const x2_safe = x2_raw ?? x1_safe;
        const y2_safe = y2_raw ?? y1_safe;
        const x1 = x1_safe * scaleFactor;
        const y1 = y1_safe * scaleFactor;
        const width = Math.max(0, (x2_safe - x1_safe) * scaleFactor);
        const height = Math.max(0, (y2_safe - y1_safe) * scaleFactor);

        const bboxStyle: React.CSSProperties = {
            /* ... */ position: "absolute",
            left: `${x1}px`,
            top: `${y1}px`,
            width: `${width}px`,
            height: `${height}px`,
            border: `2px solid ${color}`,
            pointerEvents: "none",
        };
        const labelStyle: React.CSSProperties = {
            /* ... */ position: "absolute",
            left: `${x1}px`,
            top: `${y1 - 20}px`,
            color: color,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            padding: "2px 4px",
            fontSize: "0.8rem",
            fontWeight: "bold",
            whiteSpace: "nowrap",
            pointerEvents: "none",
        };

        return {
            bboxStyle,
            labelStyle,
            labelText: renderTargetLabel(index),
            isValid: width > 0 && height > 0,
        };
    };

    // --- Main Render ---
    // ... (Keep Queue & Status Table structure, but Status table content might need rethinking)
    // The status table might now show if a target ID has *ever* been submitted successfully,
    // rather than the current image's completion status. This requires backend state.
    // For now, let's leave the status table as is, but its meaning is less direct.

    return (
        <Box className="reports-container" sx={{ p: 2 }}>
            {/* Global Error Alert */}
            {error &&
                !isSubmitting && ( // Show general errors, hide during submit?
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}
            {/* Submission specific errors could be shown near the submit button */}

            <Grid container spacing={2}>
                {/* Top Row: Queue & Status (Keep Structure) */}
                <Grid item xs={12} md={8}>
                    {/* Image Queue Card ... (Keep existing structure) */}
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Image Queue
                            </Typography>
                            {/* ... Queue rendering logic ... */}
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                    {/* Target Status Table Card ... (Keep existing structure, content meaning might change) */}
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Mission Target Status
                            </Typography>
                            <TableContainer component={Paper}>
                                <Table stickyHeader size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Assignee</TableCell>
                                            <TableCell>
                                                Expected Object
                                            </TableCell>
                                            {/* <TableCell align="center">Status</TableCell> */}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {missionAssignments.map(
                                            (assignment) => (
                                                <TableRow
                                                    key={assignment.Index}
                                                    hover
                                                >
                                                    <TableCell>
                                                        {airdropIndexToJSON(
                                                            assignment.Index
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {oDLCObjectsToJSON(
                                                            assignment.Object
                                                        )}
                                                    </TableCell>
                                                    {/* Status Icon - Maybe show if *ever* submitted? Needs backend state */}
                                                    {/* <TableCell align="center"> ... </TableCell> */}
                                                </TableRow>
                                            )
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Bottom Row: Current Image & Actions */}
                <Grid item xs={12} md={8}>
                    {/* Current Image Display Card ... (Keep existing structure) */}
                    <Card>
                        <CardContent>
                            {/* ... Title and Run ID ... */}
                            <Box
                                className="reports-current-image-container"
                                sx={{ position: "relative" }}
                            >
                                {/* ... Image rendering ... */}
                                {currentRun ? (
                                    <>
                                        <img
                                            id="current-target-image"
                                            src={`data:image/png;base64,${currentRun.Picture}`}
                                            alt={`Image Run ${currentRun.runId}`}
                                            className="reports-current-image"
                                            style={{
                                                display: "block",
                                                maxWidth: "100%",
                                                height: "auto",
                                            }}
                                        />
                                        {/* Overlay BBoxes and Labels */}
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
                                                            className="reports-bbox"
                                                            style={bboxStyle}
                                                        />
                                                        <Typography
                                                            component="span"
                                                            className="reports-bbox-label"
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
                                        sx={{ textAlign: "center", p: 5 }}
                                    >
                                        Waiting for image data...
                                    </Typography>
                                )}
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                    {/* Match Targets Actions */}
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
                                                undefined
                                                    ? airdropIndexToJSON(
                                                          currentMatch.airdropIndex
                                                      )
                                                    : "";
                                            const assignedObjectTypeJsonValue =
                                                currentMatch?.objectType !==
                                                undefined
                                                    ? oDLCObjectsToJSON(
                                                          currentMatch.objectType
                                                      )
                                                    : "";

                                            // --- Check if AirdropIndex is assigned elsewhere in this run ---
                                            const assignedIndex =
                                                currentMatch?.airdropIndex;
                                            const isIndexAssignedElsewhere =
                                                assignedIndex !== undefined &&
                                                Object.entries(
                                                    currentDetectionMatches
                                                ).some(
                                                    ([key, match]) =>
                                                        key !==
                                                            detection.compositeKey &&
                                                        match?.airdropIndex ===
                                                            assignedIndex
                                                );
                                            // --- Check if this detection has been submitted ---
                                            const isDisabled =
                                                isCurrentRunSubmitted ||
                                                isSubmitting;

                                            return (
                                                <Paper
                                                    key={detection.compositeKey}
                                                    elevation={2}
                                                    sx={{
                                                        p: 1.5,
                                                        opacity: isDisabled
                                                            ? 0.7
                                                            : 1,
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

                                                    {/* Airdrop Index Selection */}
                                                    <FormControl
                                                        fullWidth
                                                        size="small"
                                                        sx={{ mb: 1 }}
                                                        disabled={isDisabled}
                                                    >
                                                        <InputLabel
                                                            id={`assignee-label-${detection.compositeKey}`}
                                                        >
                                                            Mission Target
                                                        </InputLabel>
                                                        <Select
                                                            labelId={`assignee-label-${detection.compositeKey}`}
                                                            label="Mission Target"
                                                            value={
                                                                assignedAirdropJsonValue
                                                            }
                                                            onChange={(e) =>
                                                                handleMatchUpdate(
                                                                    detection.compositeKey,
                                                                    "airdropIndex",
                                                                    e
                                                                )
                                                            }
                                                            displayEmpty
                                                            renderValue={(
                                                                selectedValue
                                                            ) => {
                                                                if (
                                                                    selectedValue ===
                                                                    ""
                                                                )
                                                                    return (
                                                                        <em>
                                                                            Assign
                                                                            Target
                                                                            ID...
                                                                        </em>
                                                                    );
                                                                return selectedValue; // Just show the ID name
                                                            }}
                                                        >
                                                            <MenuItem value="">
                                                                <em>
                                                                    Clear
                                                                    Assignment
                                                                </em>
                                                            </MenuItem>
                                                            {REQUIRED_AIRDROP_INDICES.map(
                                                                (idxEnum) => {
                                                                    const idxJsonValue =
                                                                        airdropIndexToJSON(
                                                                            idxEnum
                                                                        );
                                                                    // Check if this index is assigned to *another* detection in this run
                                                                    const isAssignedElsewhere =
                                                                        Object.entries(
                                                                            currentDetectionMatches
                                                                        ).some(
                                                                            ([
                                                                                key,
                                                                                match,
                                                                            ]) =>
                                                                                key !==
                                                                                    detection.compositeKey &&
                                                                                match?.airdropIndex ===
                                                                                    idxEnum
                                                                        );
                                                                    return (
                                                                        <MenuItem
                                                                            key={
                                                                                idxJsonValue
                                                                            }
                                                                            value={
                                                                                idxJsonValue
                                                                            }
                                                                            disabled={
                                                                                isAssignedElsewhere
                                                                            }
                                                                        >
                                                                            {
                                                                                idxJsonValue
                                                                            }{" "}
                                                                            {isAssignedElsewhere
                                                                                ? "(Assigned)"
                                                                                : ""}
                                                                        </MenuItem>
                                                                    );
                                                                }
                                                            )}
                                                        </Select>
                                                        {isIndexAssignedElsewhere && (
                                                            <FormHelperText
                                                                error
                                                            >
                                                                ID assigned
                                                                elsewhere
                                                            </FormHelperText>
                                                        )}
                                                    </FormControl>

                                                    {/* Object Type Selection */}
                                                    <FormControl
                                                        fullWidth
                                                        size="small"
                                                        sx={{ mb: 1 }}
                                                        disabled={
                                                            isDisabled ||
                                                            !currentMatch?.airdropIndex
                                                        }
                                                    >
                                                        <InputLabel
                                                            id={`object-type-label-${detection.compositeKey}`}
                                                        >
                                                            Object Type
                                                        </InputLabel>
                                                        <Select
                                                            labelId={`object-type-label-${detection.compositeKey}`}
                                                            label="Object Type"
                                                            value={
                                                                assignedObjectTypeJsonValue
                                                            }
                                                            onChange={(e) =>
                                                                handleMatchUpdate(
                                                                    detection.compositeKey,
                                                                    "objectType",
                                                                    e
                                                                )
                                                            }
                                                            displayEmpty
                                                        >
                                                            {/* Maybe add a "Select Type..." option? */}
                                                            <MenuItem value="">
                                                                <em>
                                                                    Select
                                                                    Type...
                                                                </em>
                                                            </MenuItem>
                                                            {Object.entries(
                                                                ODLCObjects
                                                            ) // Iterate over enum values
                                                                // Filter out potential number keys if iterating over TS enum, and maybe UNKNOWN/UNSPECIFIED
                                                                .filter(
                                                                    ([
                                                                        key,
                                                                        value,
                                                                    ]) =>
                                                                        typeof value ===
                                                                            "number" &&
                                                                        value >=
                                                                            0 /* Adjust filter if needed */
                                                                )
                                                                .map(
                                                                    ([
                                                                        key,
                                                                        value,
                                                                    ]) => (
                                                                        <MenuItem
                                                                            key={
                                                                                key
                                                                            }
                                                                            value={oDLCObjectsToJSON(
                                                                                value as ODLCObjects
                                                                            )}
                                                                        >
                                                                            {oDLCObjectsToJSON(
                                                                                value as ODLCObjects
                                                                            )}
                                                                        </MenuItem>
                                                                    )
                                                                )}
                                                        </Select>
                                                    </FormControl>
                                                </Paper>
                                            );
                                        }
                                    )}

                                    {/* Submit Button */}
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        onClick={handleSubmitMatches}
                                        disabled={
                                            !isCurrentRunFullyMatched ||
                                            isSubmitting ||
                                            isCurrentRunSubmitted
                                        }
                                        fullWidth
                                        sx={{ mt: 1 }}
                                        startIcon={
                                            isSubmitting ? (
                                                <CircularProgress
                                                    size={20}
                                                    color="inherit"
                                                />
                                            ) : null
                                        }
                                    >
                                        {isCurrentRunSubmitted
                                            ? "Matches Submitted"
                                            : isSubmitting
                                            ? "Submitting..."
                                            : "Submit All Matches for Image"}
                                    </Button>
                                    {/* Display submission errors near the button */}
                                    {error && isSubmitting && (
                                        <Alert severity="error" sx={{ mt: 1 }}>
                                            {error}
                                        </Alert>
                                    )}

                                    {/* Next Image Button */}
                                    <Button
                                        variant="outlined" // Changed styling
                                        onClick={handleNextImage}
                                        disabled={
                                            currentRunIndex >=
                                                imageRuns.length - 1 ||
                                            isSubmitting
                                        } // Disable while submitting
                                        fullWidth
                                        sx={{ mt: 1 }}
                                    >
                                        {currentRunIndex >= imageRuns.length - 1
                                            ? "Waiting for more images..."
                                            : "Next Image"}
                                    </Button>
                                </Box>
                            ) : (
                                <Typography
                                    color="textSecondary"
                                    sx={{ textAlign: "center", p: 3 }}
                                >
                                    {currentRun &&
                                    currentDetections.length === 0
                                        ? "No detections found in this image."
                                        : "Waiting for image run data or detections..."}
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
