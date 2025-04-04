// src/pages/Reports.tsx
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
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import PhotoSizeSelectActualIcon from "@mui/icons-material/PhotoSizeSelectActual";

import {
    IdentifiedTarget, // Use the generated interface directly
    Airdrop,
    AirdropIndex,
    ODLCObjects,
    airdropIndexToJSON,
    oDLCObjectsToJSON,
    GPSCoord,
    BboxProto,
} from "../protos/obc.pb"; // Adjust path as needed

// --- Constants ---
const POLLING_INTERVAL_MS = 10000; // 10 seconds

// --- Mock/Placeholder Data ---
const MOCK_MISSION_ASSIGNMENTS: Airdrop[] = [
    { Index: AirdropIndex.Kaz, Object: ODLCObjects.Airplane },
    { Index: AirdropIndex.Kimi, Object: ODLCObjects.Bus },
    { Index: AirdropIndex.Chris, Object: ODLCObjects.Boat },
    { Index: AirdropIndex.Daniel, Object: ODLCObjects.Suitcase },
];

// --- Helper Functions ---

const fetchTargets = async (): Promise<IdentifiedTarget[]> => {
    const response = await fetch("/api/targets/all");
    if (!response.ok) {
        throw new Error(
            `HTTP error! status: ${response.status} ${response.statusText}`
        );
    }
    const data = await response.json(); // Expects an array of JSON objects matching IdentifiedTarget structure

    if (!Array.isArray(data)) {
        console.error("Received non-array data from /api/targets/all:", data);
        throw new Error("Invalid data format received from server.");
    }
    // Use IdentifiedTarget.fromJSON to convert plain JS objects to protobuf message instances
    return data.map((item) => IdentifiedTarget.fromJSON(item));
};

// IMPORTANT BACKEND NOTE:
// The current POST /api/targets/matched likely expects a simple ID.
// With the new structure where one Image Run (IdentifiedTarget) has multiple detections,
// the backend needs a way to know WHICH detection within a run is being matched/rejected.
// Suggestion: Update backend to accept e.g., { run_id: number, detection_index: number, assignment: AirdropIndex }
// For now, this frontend code generates a *placeholder* targetId for the POST payload,
// assuming the first detection is being targeted, which is likely WRONG.
// This needs backend alignment.

const postMatch = async (payload: {
    [key: string]: number;
}): Promise<boolean> => {
    // Using the OLD payload structure as a placeholder until backend is updated
    console.warn(
        "Using potentially incorrect payload structure for POST /api/targets/matched. Backend alignment needed.",
        payload
    );
    try {
        const response = await fetch("/api/targets/matched", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Match POST failed:", response.status, errorBody);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        console.log(
            "Match POST successful (using placeholder payload):",
            payload
        );
        return true;
    } catch (error) {
        console.error("Error posting match:", error);
        return false;
    }
};

const postReject = async (placeholderTargetId: number): Promise<boolean> => {
    // Using a placeholder target_id structure until backend is updated
    console.warn(
        `Using potentially incorrect payload structure for POST /api/targets/reject. Placeholder ID: ${placeholderTargetId}. Backend alignment needed.`
    );
    try {
        const response = await fetch("/api/targets/reject", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ target_id: placeholderTargetId }), // Placeholder
        });
        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Reject POST failed:", response.status, errorBody);
            throw new Error(
                `HTTP error! status: ${response.status} for placeholder target ${placeholderTargetId}`
            );
        }
        console.log(
            `Successfully rejected target (using placeholder ID ${placeholderTargetId})`
        );
        return true;
    } catch (error) {
        console.error(
            `Error rejecting target (placeholder ID ${placeholderTargetId}):`,
            error
        );
        return false;
    }
};

// Interface representing a single detection within an Image Run
interface DetectionInfo {
    runId: number;
    detectionIndex: number; // Index within the coordinates/bboxes arrays
    compositeKey: string; // Unique key for React state: `${runId}-${detectionIndex}`
    coordinate: GPSCoord;
    bbox: BboxProto;
}

// --- Component ---

const Reports: React.FC = () => {
    // State now holds the list of IdentifiedTarget objects directly
    const [imageRuns, setImageRuns] = useState<IdentifiedTarget[]>([]);
    const [currentRunIndex, setCurrentRunIndex] = useState<number>(0);
    const [missionAssignments] = useState<Airdrop[]>(MOCK_MISSION_ASSIGNMENTS);
    const [seenRunIds, setSeenRunIds] = useState<Set<number>>(new Set());

    // State for the *current* image run's detections being processed
    // Keys are the compositeKey: `${runId}-${detectionIndex}`
    const [detectionAssignments, setDetectionAssignments] = useState<{
        [compositeKey: string]: AirdropIndex;
    }>({});
    const [detectionStatuses, setDetectionStatuses] = useState<{
        [compositeKey: string]: "confirmed" | "rejected" | null;
    }>({});

    // Overall status tracking for mission targets (remains the same)
    const [airdropCompletionStatus, setAirdropCompletionStatus] = useState<{
        [key in AirdropIndex]?: boolean;
    }>({});

    const [error, setError] = useState<string | null>(null); // Only for major initial load errors now
    const [isPolling, setIsPolling] = useState<boolean>(false);

    const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
    const isMountedRef = useRef<boolean>(true); // Track mount status for async operations

    // --- Data Processing Logic ---
    const processFetchedRuns = useCallback(
        (fetchedRuns: IdentifiedTarget[]) => {
            let newRunsFound = false;
            const newRuns = fetchedRuns.filter(
                (run) => !seenRunIds.has(run.runId)
            );

            if (newRuns.length > 0) {
                newRunsFound = true;
                console.log(`Processing ${newRuns.length} new image runs.`);

                // Add new runs to the existing list
                if (isMountedRef.current) {
                    setImageRuns((prevRuns) => [...prevRuns, ...newRuns]);

                    // Update seen IDs *after* processing
                    setSeenRunIds((prevIds) => {
                        const updatedIds = new Set(prevIds);
                        newRuns.forEach((run) => updatedIds.add(run.runId));
                        return updatedIds;
                    });
                }
            } else {
                // console.log("Polling: No new image runs found.");
            }
            return newRunsFound;
        },
        [seenRunIds]
    ); // Dependency: seenRunIds

    // --- Data Fetching ---
    const fetchAndProcessLatest = useCallback(
        async (isInitialFetch = false) => {
            if (isPolling && !isInitialFetch) return; // Prevent overlap

            if (!isInitialFetch) setIsPolling(true);
            // No global isLoading state anymore

            try {
                const fetchedRuns = await fetchTargets();
                if (isMountedRef.current) {
                    // Check if still mounted before processing/setting state
                    processFetchedRuns(fetchedRuns);
                    if (isInitialFetch && fetchedRuns.length === 0) {
                        console.log("Initial fetch returned no image runs.");
                    }
                    setError(null); // Clear previous errors on success
                }
                // eslint-disable-next-line
            } catch (err: any) {
                console.error(
                    `Error during ${
                        isInitialFetch ? "initial fetch" : "poll"
                    }:`,
                    err
                );
                // Only set persistent error on initial fetch failure
                if (isInitialFetch && isMountedRef.current) {
                    setError(
                        `Failed initial load: ${err.message}. Will poll for updates.`
                    );
                }
            } finally {
                if (isMountedRef.current) {
                    // Check mount status before setting state
                    if (!isInitialFetch) setIsPolling(false);
                }
            }
        },
        [processFetchedRuns, isPolling]
    ); // Dependencies

    // --- Effects ---
    // Initial Load and Set Interval
    useEffect(() => {
        isMountedRef.current = true;
        fetchAndProcessLatest(true); // Initial fetch

        intervalIdRef.current = setInterval(() => {
            fetchAndProcessLatest(false); // Polling fetch
        }, POLLING_INTERVAL_MS);

        // Cleanup
        return () => {
            isMountedRef.current = false; // Mark as unmounted
            if (intervalIdRef.current) {
                clearInterval(intervalIdRef.current);
                console.log("Cleared target polling interval.");
            }
        };
    }, [fetchAndProcessLatest]); // fetchAndProcessLatest is memoized

    // --- Memoized Current Run and Detections ---
    const currentRun = useMemo(() => {
        if (imageRuns.length > 0 && currentRunIndex < imageRuns.length) {
            return imageRuns[currentRunIndex];
        }
        return null;
    }, [imageRuns, currentRunIndex]);

    const currentDetections = useMemo((): DetectionInfo[] => {
        if (!currentRun) return [];

        const detections: DetectionInfo[] = [];
        // Ensure coordinates and bboxes arrays exist and have the same length
        const numDetections = Math.min(
            currentRun.coordinates?.length ?? 0,
            currentRun.bboxes?.length ?? 0
        );

        if (
            (currentRun.coordinates?.length ?? 0) !==
            (currentRun.bboxes?.length ?? 0)
        ) {
            console.warn(
                `Run ID ${currentRun.runId}: Mismatch between coordinates (${currentRun.coordinates?.length}) and bboxes (${currentRun.bboxes?.length}). Displaying minimum.`
            );
        }

        for (let i = 0; i < numDetections; i++) {
            // Basic check for valid data before adding
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

    // --- Event Handlers ---
    const handleAssigneeChange = (
        compositeKey: string,
        event: SelectChangeEvent<string>
    ) => {
        const value = event.target.value;
        const indexKey = value as keyof typeof AirdropIndex;
        if (value !== "" && AirdropIndex[indexKey] !== undefined) {
            const airdropIndex = AirdropIndex[indexKey];
            // Check if this AirdropIndex is already assigned to another detection in *this specific run*
            const runId = compositeKey.split("-")[0];
            const alreadyAssignedInRun = Object.entries(
                detectionAssignments
            ).some(
                ([key, idx]) =>
                    key.startsWith(`${runId}-`) && // Check only within the same run
                    idx === airdropIndex &&
                    key !== compositeKey // Ensure it's not the current detection itself
            );

            if (alreadyAssignedInRun) {
                alert(
                    `${airdropIndexToJSON(
                        airdropIndex
                    )} is already assigned to another target in this image.`
                );
                return;
            }

            setDetectionAssignments((prev) => ({
                ...prev,
                [compositeKey]: airdropIndex,
            }));
        } else {
            // Unselect
            setDetectionAssignments((prev) => {
                const newState = { ...prev };
                delete newState[compositeKey];
                return newState;
            });
        }
    };

    const handleConfirm = async (detection: DetectionInfo) => {
        const assignedAirdropIndex =
            detectionAssignments[detection.compositeKey];
        if (
            assignedAirdropIndex === undefined ||
            assignedAirdropIndex === AirdropIndex.UNRECOGNIZED
        ) {
            alert("Please select a target assignee before confirming.");
            return;
        }

        setDetectionStatuses((prev) => ({
            ...prev,
            [detection.compositeKey]: "confirmed",
        }));

        // --- PLACEHOLDER PAYLOAD ---
        // This needs to be updated based on backend requirements.
        // Using the first detection's index (0) as the ID is likely incorrect.
        // Maybe use runId * 1000 + detectionIndex ? Or send structured data?
        const placeholderTargetId =
            detection.runId * 1000 + detection.detectionIndex;
        const payload = {
            [airdropIndexToJSON(assignedAirdropIndex)]: placeholderTargetId,
        };
        // --- END PLACEHOLDER ---

        const success = await postMatch(payload);
        if (success) {
            setAirdropCompletionStatus((prev) => ({
                ...prev,
                [assignedAirdropIndex]: true,
            }));
        } else {
            setDetectionStatuses((prev) => ({
                ...prev,
                [detection.compositeKey]: null,
            })); // Rollback
            alert(
                `Failed to confirm match for detection ${detection.compositeKey}.`
            );
        }
    };

    const handleReject = async (detection: DetectionInfo) => {
        setDetectionStatuses((prev) => ({
            ...prev,
            [detection.compositeKey]: "rejected",
        }));

        // --- PLACEHOLDER PAYLOAD ---
        const placeholderTargetId =
            detection.runId * 1000 + detection.detectionIndex;
        // --- END PLACEHOLDER ---

        const success = await postReject(placeholderTargetId);
        if (!success) {
            setDetectionStatuses((prev) => ({
                ...prev,
                [detection.compositeKey]: null,
            })); // Rollback
            alert(`Failed to reject detection ${detection.compositeKey}.`);
        }
    };

    const handleNextImage = () => {
        if (currentRunIndex < imageRuns.length - 1) {
            setCurrentRunIndex((prev) => prev + 1);
            // Reset states for the new *run's* detections
            setDetectionAssignments({});
            setDetectionStatuses({});
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
        return `Target ${String.fromCharCode(65 + index)}`; // A, B, C...
    };

    // --- Main Render ---

    const remainingRuns = imageRuns.length - (currentRunIndex + 1);
    const displayQueue = imageRuns.slice(
        currentRunIndex + 1,
        currentRunIndex + 4
    );
    const moreImagesCount = Math.max(0, remainingRuns - 3);

    return (
        <Box sx={{ p: 2, backgroundColor: "#f0f0f0", minHeight: "100vh" }}>
            {/* Show persistent error from initial load if it occurred */}
            {error && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            <Grid container spacing={2}>
                {/* Top Row */}
                <Grid item xs={12} md={8}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Image Queue
                            </Typography>
                            <Box
                                sx={{
                                    display: "flex",
                                    gap: 1,
                                    alignItems: "center",
                                }}
                            >
                                {/* Actual queued images */}
                                {displayQueue.map((run, idx) => (
                                    <Box
                                        key={run.runId}
                                        sx={{ textAlign: "center" }}
                                    >
                                        <img
                                            src={`data:image/png;base64,${run.Picture}`}
                                            alt={`Run ${run.runId} ${idx}`}
                                            style={{
                                                width: 80,
                                                height: 80,
                                                objectFit: "cover",
                                                border: "1px solid grey",
                                                borderRadius: "4px",
                                            }}
                                        />
                                    </Box>
                                ))}
                                {/* Placeholder boxes */}
                                {Array.from({
                                    length: Math.max(
                                        0,
                                        3 - displayQueue.length
                                    ),
                                }).map((_, idx) =>
                                    // Add extra placeholders if imageRuns is empty initially
                                    (imageRuns.length === 0 && idx < 2) ||
                                    imageRuns.length > 0 ? (
                                        <Box
                                            key={`placeholder-${idx}`}
                                            sx={{
                                                width: 80,
                                                height: 80,
                                                backgroundColor: "#e0e0e0",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                borderRadius: "4px",
                                                border: "1px solid grey",
                                            }}
                                        >
                                            <PhotoSizeSelectActualIcon color="disabled" />
                                        </Box>
                                    ) : null
                                )}
                                {/* "X more images" text */}
                                {moreImagesCount > 0 && (
                                    <Typography sx={{ ml: 1 }}>
                                        {moreImagesCount} more images...
                                    </Typography>
                                )}
                                {isPolling && (
                                    <CircularProgress
                                        size={20}
                                        sx={{ ml: 2 }}
                                        titleAccess="Checking for new images..."
                                    />
                                )}
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                    {/* Target Status */}
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Target Status
                            </Typography>
                            <TableContainer
                                component={Paper}
                                sx={{ maxHeight: 200, overflowY: "auto" }}
                            >
                                <Table stickyHeader size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Assignee</TableCell>
                                            <TableCell>Object</TableCell>
                                            <TableCell>Status</TableCell>
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
                                                    <TableCell>
                                                        {airdropCompletionStatus[
                                                            assignment.Index
                                                        ] === true && (
                                                            <CheckCircleIcon color="success" />
                                                        )}
                                                        {airdropCompletionStatus[
                                                            assignment.Index
                                                        ] !== true && (
                                                            <Box
                                                                sx={{
                                                                    width: 24,
                                                                    height: 24,
                                                                }}
                                                            />
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Bottom Row */}
                <Grid item xs={12} md={8}>
                    {/* Current Image Display */}
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Current Image{" "}
                                {imageRuns.length > 0
                                    ? `(${currentRunIndex + 1} of ${
                                          imageRuns.length
                                      })`
                                    : "(Waiting...)"}
                                {currentRun && (
                                    <Typography
                                        variant="caption"
                                        sx={{ ml: 1 }}
                                    >
                                        Run ID: {currentRun.runId}
                                    </Typography>
                                )}
                            </Typography>
                            <Box
                                sx={{
                                    position: "relative",
                                    minHeight: 200,
                                    width: "100%",
                                    overflow: "hidden",
                                    border: "1px solid #ccc",
                                    background: "#e0e0e0",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                {currentRun ? (
                                    <>
                                        <img
                                            id="current-target-image"
                                            src={`data:image/png;base64,${currentRun.Picture}`}
                                            alt={`Image Run ${currentRun.runId}`}
                                            style={{
                                                display: "block",
                                                width: "100%",
                                                height: "auto",
                                                background: "white",
                                            }}
                                        />
                                        {/* Overlay Bounding Boxes and Labels for detections */}
                                        {currentDetections.map(
                                            (detection, index) => {
                                                const imgElement =
                                                    document.getElementById(
                                                        "current-target-image"
                                                    );
                                                const displayWidth =
                                                    imgElement?.offsetWidth ??
                                                    1;
                                                const naturalWidth =
                                                    imgElement instanceof
                                                    HTMLImageElement
                                                        ? imgElement.naturalWidth
                                                        : displayWidth;
                                                const scaleFactor =
                                                    naturalWidth > 0
                                                        ? displayWidth /
                                                          naturalWidth
                                                        : 1;

                                                const {
                                                    x1: x1_raw,
                                                    y1: y1_raw,
                                                    x2: x2_raw,
                                                    y2: y2_raw,
                                                } = detection.bbox;
                                                const x1 =
                                                    (x1_raw ?? 0) * scaleFactor;
                                                const y1 =
                                                    (y1_raw ?? 0) * scaleFactor;
                                                const width =
                                                    ((x2_raw ?? x1_raw ?? 0) -
                                                        (x1_raw ?? 0)) *
                                                    scaleFactor;
                                                const height =
                                                    ((y2_raw ?? y1_raw ?? 0) -
                                                        (y1_raw ?? 0)) *
                                                    scaleFactor;

                                                const currentStatus =
                                                    detectionStatuses[
                                                        detection.compositeKey
                                                    ];
                                                const isConfirmed =
                                                    currentStatus ===
                                                    "confirmed";
                                                const isRejected =
                                                    currentStatus ===
                                                    "rejected";
                                                const borderColor = isConfirmed
                                                    ? "lime"
                                                    : isRejected
                                                    ? "red"
                                                    : "cyan";
                                                const labelColor = isConfirmed
                                                    ? "lime"
                                                    : isRejected
                                                    ? "red"
                                                    : "cyan";

                                                if (width <= 0 || height <= 0)
                                                    return null; // Skip invalid boxes

                                                return (
                                                    <React.Fragment
                                                        key={
                                                            detection.compositeKey
                                                        }
                                                    >
                                                        <Box
                                                            sx={{
                                                                position:
                                                                    "absolute",
                                                                left: `${x1}px`,
                                                                top: `${y1}px`,
                                                                width: `${width}px`,
                                                                height: `${height}px`,
                                                                border: `2px solid ${borderColor}`,
                                                                boxSizing:
                                                                    "border-box",
                                                                pointerEvents:
                                                                    "none",
                                                            }}
                                                        />
                                                        <Typography
                                                            sx={{
                                                                position:
                                                                    "absolute",
                                                                left: `${x1}px`,
                                                                top: `${
                                                                    y1 - 20
                                                                }px`,
                                                                color: labelColor,
                                                                backgroundColor:
                                                                    "rgba(0, 0, 0, 0.6)",
                                                                padding:
                                                                    "0 2px",
                                                                fontSize:
                                                                    "0.8rem",
                                                                fontWeight:
                                                                    "bold",
                                                                pointerEvents:
                                                                    "none",
                                                                whiteSpace:
                                                                    "nowrap",
                                                            }}
                                                        >
                                                            {renderTargetLabel(
                                                                index
                                                            )}
                                                        </Typography>
                                                    </React.Fragment>
                                                );
                                            }
                                        )}
                                    </>
                                ) : (
                                    <Typography color="textSecondary">
                                        Waiting for image data...
                                    </Typography>
                                )}
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                    {/* Confirm Targets Actions */}
                    <Card>
                        <CardContent
                            sx={{
                                maxHeight: "calc(100vh - 250px)",
                                overflowY: "auto",
                            }}
                        >
                            <Typography variant="h6" gutterBottom>
                                Confirm Targets
                            </Typography>
                            {currentRun && currentDetections.length > 0 ? (
                                <>
                                    {currentDetections.map(
                                        (detection, index) => {
                                            const currentStatus =
                                                detectionStatuses[
                                                    detection.compositeKey
                                                ];
                                            const isProcessed =
                                                currentStatus === "confirmed" ||
                                                currentStatus === "rejected";
                                            const assigneeValue =
                                                detectionAssignments[
                                                    detection.compositeKey
                                                ];
                                            const assigneeString =
                                                assigneeValue !== undefined
                                                    ? airdropIndexToJSON(
                                                          assigneeValue
                                                      )
                                                    : "";

                                            return (
                                                <Paper
                                                    key={detection.compositeKey}
                                                    elevation={2}
                                                    sx={{
                                                        p: 1.5,
                                                        mb: 1.5,
                                                        backgroundColor:
                                                            isProcessed
                                                                ? "#e0e0e0"
                                                                : "white",
                                                        opacity: isProcessed
                                                            ? 0.7
                                                            : 1,
                                                    }}
                                                >
                                                    <Typography
                                                        variant="subtitle1"
                                                        gutterBottom
                                                    >
                                                        {renderTargetLabel(
                                                            index
                                                        )}
                                                        <Typography
                                                            component="span"
                                                            variant="body2"
                                                            sx={{
                                                                ml: 1,
                                                                color: "text.secondary",
                                                            }}
                                                        >
                                                            {formatCoordinates(
                                                                detection.coordinate
                                                            )}
                                                        </Typography>
                                                    </Typography>
                                                    <Select
                                                        fullWidth
                                                        value={assigneeString}
                                                        onChange={(e) =>
                                                            handleAssigneeChange(
                                                                detection.compositeKey,
                                                                e
                                                            )
                                                        }
                                                        displayEmpty
                                                        size="small"
                                                        disabled={isProcessed}
                                                        sx={{ mb: 1 }}
                                                        renderValue={(
                                                            selected
                                                        ) => {
                                                            if (selected === "")
                                                                return (
                                                                    <em>
                                                                        Select
                                                                        Assignee...
                                                                    </em>
                                                                );
                                                            const selectedIndex =
                                                                AirdropIndex[
                                                                    selected as keyof typeof AirdropIndex
                                                                ];
                                                            const assignment =
                                                                missionAssignments.find(
                                                                    (a) =>
                                                                        a.Index ===
                                                                        selectedIndex
                                                                );
                                                            return `${selected} (${
                                                                assignment
                                                                    ? oDLCObjectsToJSON(
                                                                          assignment.Object
                                                                      )
                                                                    : "???"
                                                            })`;
                                                        }}
                                                    >
                                                        <MenuItem
                                                            value=""
                                                            disabled
                                                        >
                                                            <em>
                                                                Select
                                                                Assignee...
                                                            </em>
                                                        </MenuItem>
                                                        {missionAssignments.map(
                                                            (assignment) => {
                                                                const assignmentKey =
                                                                    airdropIndexToJSON(
                                                                        assignment.Index
                                                                    );
                                                                const isGloballyConfirmed =
                                                                    airdropCompletionStatus[
                                                                        assignment
                                                                            .Index
                                                                    ];
                                                                // Check if assigned to *another* detection *in this specific run*
                                                                const isLocallyAssigned =
                                                                    Object.entries(
                                                                        detectionAssignments
                                                                    ).some(
                                                                        ([
                                                                            key,
                                                                            idx,
                                                                        ]) =>
                                                                            key.startsWith(
                                                                                `${detection.runId}-`
                                                                            ) &&
                                                                            idx ===
                                                                                assignment.Index &&
                                                                            key !==
                                                                                detection.compositeKey
                                                                    );
                                                                return (
                                                                    <MenuItem
                                                                        key={
                                                                            assignment.Index
                                                                        }
                                                                        value={
                                                                            assignmentKey
                                                                        }
                                                                        disabled={
                                                                            !!isGloballyConfirmed ||
                                                                            isLocallyAssigned
                                                                        }
                                                                    >
                                                                        {
                                                                            assignmentKey
                                                                        }{" "}
                                                                        (
                                                                        {oDLCObjectsToJSON(
                                                                            assignment.Object
                                                                        )}
                                                                        ){" "}
                                                                        {isGloballyConfirmed
                                                                            ? "(Done)"
                                                                            : ""}
                                                                    </MenuItem>
                                                                );
                                                            }
                                                        )}
                                                    </Select>
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            justifyContent:
                                                                "space-between",
                                                            gap: 1,
                                                        }}
                                                    >
                                                        <Button
                                                            variant="contained"
                                                            color="success"
                                                            size="small"
                                                            onClick={() =>
                                                                handleConfirm(
                                                                    detection
                                                                )
                                                            }
                                                            disabled={
                                                                isProcessed ||
                                                                assigneeValue ===
                                                                    undefined
                                                            }
                                                            startIcon={
                                                                currentStatus ===
                                                                "confirmed" ? (
                                                                    <CheckCircleIcon />
                                                                ) : null
                                                            }
                                                            sx={{ flexGrow: 1 }}
                                                        >
                                                            {currentStatus ===
                                                            "confirmed"
                                                                ? "Confirmed"
                                                                : "Confirm"}
                                                        </Button>
                                                        <Button
                                                            variant="contained"
                                                            color="error"
                                                            size="small"
                                                            onClick={() =>
                                                                handleReject(
                                                                    detection
                                                                )
                                                            }
                                                            disabled={
                                                                isProcessed
                                                            }
                                                            startIcon={
                                                                currentStatus ===
                                                                "rejected" ? (
                                                                    <CancelIcon />
                                                                ) : null
                                                            }
                                                            sx={{ flexGrow: 1 }}
                                                        >
                                                            {currentStatus ===
                                                            "rejected"
                                                                ? "Rejected"
                                                                : "Reject"}
                                                        </Button>
                                                    </Box>
                                                </Paper>
                                            );
                                        }
                                    )}
                                    <Button
                                        variant="contained"
                                        onClick={handleNextImage}
                                        disabled={
                                            currentRunIndex >=
                                            imageRuns.length - 1
                                        }
                                        fullWidth
                                        sx={{ mt: 2 }}
                                    >
                                        {currentRunIndex >= imageRuns.length - 1
                                            ? "Waiting for more images..."
                                            : "I'm done. Next image..."}
                                    </Button>
                                </>
                            ) : (
                                <Typography
                                    color="textSecondary"
                                    sx={{ mt: 2, textAlign: "center" }}
                                >
                                    {currentRun &&
                                    currentDetections.length === 0
                                        ? "No detections in this image."
                                        : "Waiting for image run data..."}
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
