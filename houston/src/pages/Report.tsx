// FILE: Report.tsx (Refactored for Persistence, Undefined=0, and 404 Debugging)

// =======================================================================
// == IMPORTANT: MAKE SURE YOU HAVE REGENERATED obc.pb.ts FROM THE   	==
// ==        	UPDATED .proto FILE BEFORE USING THIS CODE!        	==
// =======================================================================

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  TextField,
  Stack, // <-- ADDED FOR LAYOUT FIX
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
  Mission,
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
    if (!Array.isArray(data)) throw new Error("Invalid data format from /targets/all");
    return data.map((item) => IdentifiedTarget.fromJSON(item));
  } catch (error) {
    console.error("Error fetching targets from /targets/all:", error);
    throw error;
  }
};

const postMatchedTargets = async (payload: AirdropTarget[]): Promise<boolean> => {
  console.log(`POSTING FINAL MATCHES to ${TARGET_MATCHED_ENDPOINT}:`, payload);
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
        errorBody,
      );
      if (response.status === 404) {
        throw new Error(
          `Endpoint not found (${response.status}): POST ${TARGET_MATCHED_ENDPOINT}. Check backend route and dev proxy.`,
        );
      } else {
        throw new Error(`HTTP ${response.status} - ${errorBody || response.statusText}`);
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
      if (response.status === 404) {
        console.log("No saved runs found on server (404).");
        return [];
      }
      throw new Error(`HTTP ${response.status} fetching saved runs`);
    }
    const text = await response.text();
    if (!text) {
      console.log("Received empty response body from saved runs endpoint.");
      return [];
    }
    const data = JSON.parse(text);

    if (!Array.isArray(data)) {
      if (typeof data === "object" && Object.keys(data).length === 0) {
        console.warn(
          "Saved runs endpoint returned an empty object, expected array. Treating as no runs.",
        );
        return [];
      }
      throw new Error("Invalid data format for saved runs (expected array)");
    }
    return data.map((item) => IdentifiedTarget.fromJSON(item));
  } catch (error) {
    console.error("Error fetching saved runs:", error);
    return [];
  }
};

// New helper to push runs to be saved
const pushSavedRunsToServer = async (runsToSave: IdentifiedTarget[]): Promise<boolean> => {
  console.log(`Pushing ${runsToSave.length} runs to ${SAVE_LOAD_REPORT_ENDPOINT}`);
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
        `HTTP ${response.status} pushing saved runs - ${errorBody || response.statusText}`,
      );
    }
    return true;
  } catch (error) {
    console.error("Error pushing saved runs:", error);
    throw error;
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
  console.log("Report component loaded");
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
  const [isPollingUI, setIsPollingUI] = useState<boolean>(false);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [isFinalSubmitting, setIsFinalSubmitting] = useState<boolean>(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  // State for persistence flow
  const [hasLoadedInitialSavedRuns, setHasLoadedInitialSavedRuns] = useState(false);
  const [isSavingRuns, setIsSavingRuns] = useState(false);

  // --- State for manual coordinate entry ---
  const [manualAirdropIndexJson, setManualAirdropIndexJson] = useState<string>("");
  const [manualObjectTypeJson, setManualObjectTypeJson] = useState<string>("");
  const [manualLatitude, setManualLatitude] = useState<string>("");
  const [manualLongitude, setManualLongitude] = useState<string>("");
  const [manualInputError, setManualInputError] = useState<string>("");

  // Refs
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const isFetchingTargetsRef = useRef<boolean>(false);

  // --- Data Processing & Fetching ---

  const processFetchedRuns = useCallback(
    (fetchedRuns: IdentifiedTarget[]): boolean => {
      let newValidRunsAddedToState = false;
      const currentRunIdsInState = new Set(imageRuns.map((r) => r.runId));

      const newValidRuns = fetchedRuns.filter((run) => {
        if (seenRunIds.has(run.runId) || currentRunIdsInState.has(run.runId)) {
          return false;
        }
        const numCoords = run.coordinates?.length ?? 0;
        const numBBoxes = run.bboxes?.length ?? 0;
        const hasDetections = numCoords > 0 && numBBoxes > 0 && Math.min(numCoords, numBBoxes) > 0;

        if (!hasDetections && !seenRunIds.has(run.runId) && isMountedRef.current) {
          setSeenRunIds((prev) => new Set(prev).add(run.runId));
        }
        return hasDetections;
      });

      if (newValidRuns.length > 0) {
        newValidRunsAddedToState = true;
        if (isMountedRef.current) {
          setImageRuns((prevRuns) => {
            const updatedRuns = [...prevRuns, ...newValidRuns];
            updatedRuns.sort((a, b) => a.runId - b.runId);
            if (prevRuns.length === 0 && updatedRuns.length > 0 && currentRunIndex === 0) {
              setTimeout(() => {
                if (isMountedRef.current && currentRunIndex === 0) setCurrentRunIndex(0);
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
    [seenRunIds, imageRuns, currentRunIndex],
  );

  const fetchAndProcessLatest = useCallback(
    async (isInitialFetch = false) => {
      if (!isInitialFetch) {
        if (isFetchingTargetsRef.current) {
          return;
        }
        isFetchingTargetsRef.current = true;
      }

      try {
        const fetched = await fetchTargets();
        if (isMountedRef.current) {
          processFetchedRuns(fetched);
        }
        if (isMountedRef.current) setError(null);
      } catch (
        err: any // eslint-disable-line
      ) {
        if (isMountedRef.current) {
          console.error(`Fetch failed (isInitial: ${isInitialFetch}): ${err.message}`);
          if (isInitialFetch) {
            setError(`Initial fetch failed: ${err.message}`);
            setSnackbarMessage(`Error fetching new runs: ${err.message}`);
            setSnackbarOpen(true);
          }
        }
      } finally {
        if (!isInitialFetch) {
          isFetchingTargetsRef.current = false;
        }
      }
    },
    [processFetchedRuns],
  );

  useEffect(() => {
    isMountedRef.current = true;
    const loadSaved = async () => {
      try {
        const savedRuns = await fetchSavedRunsFromServer();
        if (isMountedRef.current && savedRuns.length > 0) {
          processFetchedRuns(savedRuns);
          setSnackbarMessage(`Loaded ${savedRuns.length} saved run(s).`);
          setSnackbarOpen(true);
        } else if (isMountedRef.current) {
          console.log("No saved run data found or component unmounted.");
        }
      } catch (
        loadError: any // eslint-disable-line
      ) {
        console.error("Error loading saved runs during init:", loadError);
        if (isMountedRef.current) {
          setError(`Failed to load saved run data: ${loadError.message}`);
          setSnackbarMessage(`Error loading saved runs: ${loadError.message}`);
          setSnackbarOpen(true);
        }
      } finally {
        if (isMountedRef.current) {
          setHasLoadedInitialSavedRuns(true);
        }
      }
    };
    loadSaved();
  }, [processFetchedRuns]);

  useEffect(() => {
    if (!hasLoadedInitialSavedRuns || !isMountedRef.current) {
      return;
    }

    const performInitialLiveFetch = async () => {
      if (isMountedRef.current) setIsPollingUI(true);
      await fetchAndProcessLatest(true);
      if (isMountedRef.current) setIsPollingUI(false);
    };

    performInitialLiveFetch();

    const localIntervalId = setInterval(async () => {
      if (!isMountedRef.current) {
        clearInterval(localIntervalId);
        return;
      }
      if (isMountedRef.current) setIsPollingUI(true);
      await fetchAndProcessLatest(false);
      if (isMountedRef.current) setIsPollingUI(false);
    }, POLLING_INTERVAL_MS);
    intervalIdRef.current = localIntervalId;

    return () => {
      if (localIntervalId) {
        clearInterval(localIntervalId);
      }
      intervalIdRef.current = null;
    };
  }, [hasLoadedInitialSavedRuns, fetchAndProcessLatest]);

  useEffect(() => {
    if (
      hasLoadedInitialSavedRuns &&
      imageRuns.length > 0 &&
      !isSavingRuns &&
      isMountedRef.current
    ) {
      const saveRuns = async () => {
        setIsSavingRuns(true);
        try {
          await pushSavedRunsToServer(imageRuns);
          console.log("Successfully pushed updated imageRuns to server.");
        } catch (
          pushError: any // eslint-disable-line
        ) {
          console.error("Error auto-saving runs:", pushError);
          if (isMountedRef.current) {
            setSnackbarMessage(`Error auto-saving run data: ${pushError.message}`);
            setSnackbarOpen(true);
          }
        } finally {
          if (isMountedRef.current) setIsSavingRuns(false);
        }
      };
      saveRuns();
    }
  }, [imageRuns, hasLoadedInitialSavedRuns, isSavingRuns]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
    };
  }, []);

  // TODO : probably should be a button
  const handleAutofillDropLocations = () => {
    fetch("/api/mission")
      .then((res) => res.json())
      .then((mission: Mission & { DropLocation?: GPSCoord[] }) => {
        console.log("Autofilling drop locations and object types from mission");
        const dropLocations = mission.DropLocation;
        const airdropAssignments = mission.AirdropAssignments || [];

        if (dropLocations && Array.isArray(dropLocations)) {
          const newTargets: { [key in AirdropIndex]?: AirdropTarget } = {};
          let filledCount = 0;

          for (let i = 0; i < REQUIRED_AIRDROP_INDICES.length; i++) {
            const coord = dropLocations[i];
            if (coord) {
              // Find the corresponding airdrop assignment for this index
              const assignment = airdropAssignments.find(
                (assignment) => assignment.Index === REQUIRED_AIRDROP_INDICES[i],
              );

              newTargets[REQUIRED_AIRDROP_INDICES[i]] = AirdropTarget.create({
                Index: REQUIRED_AIRDROP_INDICES[i],
                Coordinate: coord,
                Object: assignment?.Object || ODLCObjects.Bus,
              });
              filledCount++;
            }
          }
          setSubmittedTargets((prev) => ({ ...newTargets, ...prev }));
          setSnackbarMessage(
            `Autofilled ${filledCount} targets with coordinates and object types from mission`,
          );
          setSnackbarOpen(true);
        } else {
          setSnackbarMessage("No drop locations found in mission data");
          setSnackbarOpen(true);
        }
      })
      .catch((error) => {
        console.error("Error fetching mission for autofill:", error);
        setSnackbarMessage("Error fetching mission data for autofill");
        setSnackbarOpen(true);
      });
  };

  const currentRun = useMemo(
    () =>
      imageRuns.length > 0 && currentRunIndex >= 0 && currentRunIndex < imageRuns.length
        ? imageRuns[currentRunIndex]
        : null,
    [imageRuns, currentRunIndex],
  );
  const currentDetections = useMemo((): DetectionInfo[] => {
    if (!currentRun) return [];
    const detections: DetectionInfo[] = [];
    const coords = currentRun.coordinates ?? [];
    const bboxes = currentRun.bboxes ?? [];
    const numDetections = Math.min(coords.length, bboxes.length);
    if (coords.length !== bboxes.length && numDetections > 0)
      console.warn(
        `Run ${currentRun.runId}: Coord/Bbox mismatch. Coords: ${coords.length}, BBoxes: ${bboxes.length}`,
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
        match.objectType !== PLACEHOLDER_OBJECT_TYPE,
    );
  }, [currentDetectionMatches]);

  const canSubmitFinalMatches = useMemo(() => {
    return REQUIRED_AIRDROP_INDICES.every(
      (index) =>
        submittedTargets[index] !== undefined &&
        submittedTargets[index]?.Object !== ODLCObjects.Undefined,
    );
  }, [submittedTargets]);

  const handleSetManualTarget = () => {
    setManualInputError("");
    if (!manualAirdropIndexJson) {
      setManualInputError("Please select a target assignee.");
      return;
    }
    if (!manualObjectTypeJson) {
      setManualInputError("Please select an object type.");
      return;
    }

    const lat = parseFloat(manualLatitude);
    const lon = parseFloat(manualLongitude);

    if (isNaN(lat) || isNaN(lon)) {
      setManualInputError("Latitude and Longitude must be valid numbers.");
      return;
    }

    const indexEnum = airdropIndexFromJSON(manualAirdropIndexJson);
    const objectEnum = oDLCObjectsFromJSON(manualObjectTypeJson);

    if (indexEnum === AirdropIndex.UNRECOGNIZED || objectEnum === ODLCObjects.UNRECOGNIZED) {
      setManualInputError("Invalid assignee or object selected.");
      return;
    }

    const newCoord = GPSCoord.create({
      Latitude: lat,
      Longitude: lon,
      Altitude: 0,
    });

    const newTarget = AirdropTarget.create({
      Index: indexEnum,
      Coordinate: newCoord,
      Object: objectEnum,
    });

    setSubmittedTargets((prev) => ({
      ...prev,
      [indexEnum]: newTarget,
    }));

    setSnackbarMessage(`Manually set ${manualAirdropIndexJson} to ${manualObjectTypeJson}.`);
    setSnackbarOpen(true);
    // Reset form
    setManualAirdropIndexJson("");
    setManualObjectTypeJson("");
    setManualLatitude("");
    setManualLongitude("");
  };

  const handleMatchUpdate = (
    compositeKey: string,
    field: "airdropIndex" | "objectType",
    event: SelectChangeEvent<string | number>,
    detectionInfo: DetectionInfo,
  ) => {
    const selectedJsonValue = event.target.value;
    let selectedEnumValue: AirdropIndex | ODLCObjects | undefined | "" = "";

    if (selectedJsonValue === "") selectedEnumValue = "";
    else {
      try {
        if (field === "airdropIndex") selectedEnumValue = airdropIndexFromJSON(selectedJsonValue);
        else selectedEnumValue = oDLCObjectsFromJSON(selectedJsonValue);
        if (
          selectedEnumValue === AirdropIndex.UNRECOGNIZED ||
          selectedEnumValue === ODLCObjects.UNRECOGNIZED
        ) {
          console.warn("Invalid enum value selected:", selectedJsonValue);
          return;
        }
      } catch (e) {
        console.error("Enum conversion error for value:", selectedJsonValue, e);
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
          delete updatedMatches[compositeKey];
        } else if (typeof selectedEnumValue === "number" && selectedEnumValue in AirdropIndex) {
          const newAirdropIndex = selectedEnumValue as AirdropIndex;
          newMatch = {
            airdropIndex: newAirdropIndex,
            objectType: currentMatchData?.objectType ?? defaultObjectType,
            detectionInfo: detectionInfo,
          };
        }
      } else {
        if (!currentMatchData) {
          console.warn("Cannot set objectType, no airdrop index assigned to this detection yet.");
          return prev;
        }
        if (selectedEnumValue === "") {
          newMatch = {
            ...currentMatchData,
            objectType: ODLCObjects.Undefined,
          };
        } else if (typeof selectedEnumValue === "number" && selectedEnumValue in ODLCObjects) {
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
        return prev;
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
        target !== undefined && target.Object !== ODLCObjects.Undefined,
    );

    if (finalPayload.length !== REQUIRED_AIRDROP_INDICES.length) {
      console.error(
        "Final submit: Payload incomplete or contains Undefined objects.",
        finalPayload,
      );
      setError(
        "Internal error: Incomplete final target list. Ensure all targets have a defined object type.",
      );
      setIsFinalSubmitting(false);
      return;
    }

    try {
      const success = await postMatchedTargets(finalPayload);
      if (success && isMountedRef.current) {
        setSnackbarMessage("All required targets successfully submitted!");
        setSnackbarOpen(true);
      }
    } catch (
      postError: any // eslint-disable-line @typescript-eslint/no-explicit-any
    ) {
      console.error("Final submission failed:", postError);
      if (isMountedRef.current) {
        setError(`Final submission failed: ${postError.message || "Unknown error"}`);
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
        setSnackbarMessage(isPollingUI ? "Waiting for more images..." : "End of loaded images.");
        setSnackbarOpen(true);
      }
    }
  };
  const handleSnackbarClose = () => setSnackbarOpen(false);

  const formatCoordinates = (coord: GPSCoord | undefined): string => {
    if (!coord) return "N/A";
    const lat = typeof coord.Latitude === "number" ? coord.Latitude.toFixed(5) : "N/A";
    const lon = typeof coord.Longitude === "number" ? coord.Longitude.toFixed(5) : "N/A";
    return `(${lat}, ${lon})`;
  };
  const renderTargetLabel = (index: number): string =>
    `Detection ${String.fromCharCode(65 + index)}`;

  const calculateDetectionStyles = (
    detection: DetectionInfo,
    index: number,
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
      match?.airdropIndex !== undefined && match.airdropIndex !== AirdropIndex.UNRECOGNIZED;
    const color = isAssigned ? "lime" : "cyan";

    const container = imageContainerRef.current;
    const imgElement = container?.querySelector(
      "img.reports-current-image",
    ) as HTMLImageElement | null;

    if (
      !container ||
      !imgElement ||
      !imgElement.complete ||
      imgElement.naturalWidth === 0 ||
      imgElement.naturalHeight === 0
    ) {
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
    if (x1 == null || y1 == null || x2 == null || y2 == null) return defaultStyles;

    const scaledX1 = offsetX + x1 * scale;
    const scaledY1 = offsetY + y1 * scale;
    const scaledWidth = Math.max(0, (x2 - x1) * scale);
    const scaledHeight = Math.max(0, (y2 - y1) * scale);

    const isValid = scaledWidth > 1 && scaledHeight > 1;
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

  return (
    <Box className="reports-container" sx={{ p: 2 }}>
      {error && !isConfirming && !isFinalSubmitting && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={isSavingRuns || isPollingUI ? 2000 : 6000}
        onClose={handleSnackbarClose}
        message={snackbarMessage}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
      {/* === LAYOUT FIX: Main Grid now defines two columns for content === */}
      <Grid container spacing={2}>
        {/* --- Left Column --- */}
        <Grid item xs={12} md={8}>
          <Stack spacing={2}>
            {/* --- Image Queue Card --- */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Image Queue ({imageRuns.length} runs processed)
                  {isSavingRuns && (
                    <Chip
                      label="Saving..."
                      size="small"
                      sx={{
                        ml: 1,
                        fontStyle: "italic",
                      }}
                    />
                  )}
                  {isPollingUI && (
                    <Chip label="Polling..." color="secondary" size="small" sx={{ ml: 1 }} />
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
                        color={index === currentRunIndex ? "primary" : "default"}
                        variant={index === currentRunIndex ? "filled" : "outlined"}
                        onClick={() => {
                          if (index !== currentRunIndex && !isConfirming && !isFinalSubmitting) {
                            setCurrentRunIndex(index);
                            setCurrentDetectionMatches({});
                            setIsCurrentRunProcessed(false);
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
                    sx={{
                      textAlign: "center",
                      pt: 2,
                      pb: 1,
                    }}
                  >
                    {!hasLoadedInitialSavedRuns
                      ? "Initializing..."
                      : isPollingUI
                        ? "Polling for images..."
                        : "No image runs loaded."}
                  </Typography>
                )}
                {(!hasLoadedInitialSavedRuns || (isPollingUI && imageRuns.length === 0)) &&
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

            {/* --- Current Image Card --- */}
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
                    <Chip label="Confirmed" color="info" size="small" sx={{ ml: 1.5 }} />
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
                          setCurrentDetectionMatches((prev) => ({ ...prev }));
                        }}
                        onError={(e) => {
                          e.currentTarget.alt = `Error loading image for Run ${currentRun.runId}`;
                        }}
                      />
                      {currentDetections.map((detection, index) => {
                        const { bboxStyle, labelStyle, labelText, isValid } =
                          calculateDetectionStyles(detection, index);
                        if (!isValid) {
                          return null;
                        }
                        return (
                          <React.Fragment key={detection.compositeKey}>
                            <Box style={bboxStyle} />
                            <Typography component="span" style={labelStyle}>
                              {labelText}
                            </Typography>
                          </React.Fragment>
                        );
                      })}
                    </>
                  ) : (
                    <Typography color="textSecondary" sx={{ textAlign: "center", p: 3 }}>
                      {imageRuns.length > 0
                        ? "Loading image..."
                        : "No images available to display."}
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        {/* --- Right Column --- */}
        <Grid item xs={12} md={4}>
          <Stack spacing={2}>
            {/* --- Mission Status & Manual Entry Card --- */}
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
                        <TableCell>Confirmed Object</TableCell>
                        <TableCell>Coords</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {REQUIRED_AIRDROP_INDICES.map((index) => {
                        const d = submittedTargets[index];
                        return (
                          <TableRow
                            key={index}
                            hover
                            sx={{
                              background:
                                d && d.Object !== ODLCObjects.Undefined ? "#e8f5e9" : "inherit",
                            }}
                          >
                            <TableCell>{airdropIndexToJSON(index)}</TableCell>
                            <TableCell>
                              {d?.Object !== undefined && d.Object !== ODLCObjects.Undefined ? (
                                oDLCObjectsToJSON(d.Object)
                              ) : (
                                <em>Needed</em>
                              )}
                            </TableCell>
                            <TableCell>
                              {d?.Coordinate ? formatCoordinates(d.Coordinate) : "-"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* === UPDATED MANUAL TARGET ENTRY SECTION === */}
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" gutterBottom>
                  Manual Target Entry
                </Typography>
                <FormControl fullWidth size="small" sx={{ mb: 1.5 }} error={!!manualInputError}>
                  <InputLabel id="manual-airdrop-select-label">Target Assignee</InputLabel>
                  <Select
                    labelId="manual-airdrop-select-label"
                    value={manualAirdropIndexJson}
                    label="Target Assignee"
                    onChange={(e) => setManualAirdropIndexJson(e.target.value as string)}
                  >
                    <MenuItem value="">
                      <em>Select Assignee...</em>
                    </MenuItem>
                    {REQUIRED_AIRDROP_INDICES.map((idxEnum) => {
                      const jsonVal = airdropIndexToJSON(idxEnum);
                      return (
                        <MenuItem key={jsonVal} value={jsonVal}>
                          {jsonVal}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small" sx={{ mb: 1.5 }} error={!!manualInputError}>
                  <InputLabel id="manual-object-select-label">Object Type</InputLabel>
                  <Select
                    labelId="manual-object-select-label"
                    value={manualObjectTypeJson}
                    label="Object Type"
                    onChange={(e) => setManualObjectTypeJson(e.target.value as string)}
                  >
                    <MenuItem value="">
                      <em>Select Object...</em>
                    </MenuItem>
                    {Object.entries(ODLCObjects)
                      .filter(
                        ([_, v_enum]) =>
                          typeof v_enum === "number" &&
                          v_enum > 0 &&
                          v_enum !== ODLCObjects.UNRECOGNIZED,
                      )
                      .map(([k_enum, v_enum]) => {
                        const o_json = oDLCObjectsToJSON(v_enum as ODLCObjects);
                        return (
                          <MenuItem key={k_enum} value={o_json}>
                            {o_json}
                          </MenuItem>
                        );
                      })}
                  </Select>
                </FormControl>

                <Box sx={{ display: "flex", gap: 1, mb: 1.5 }}>
                  <TextField
                    label="Latitude"
                    variant="outlined"
                    size="small"
                    fullWidth
                    value={manualLatitude}
                    onChange={(e) => setManualLatitude(e.target.value)}
                    type="number"
                    inputProps={{ step: "any" }}
                  />
                  <TextField
                    label="Longitude"
                    variant="outlined"
                    size="small"
                    fullWidth
                    value={manualLongitude}
                    onChange={(e) => setManualLongitude(e.target.value)}
                    type="number"
                    inputProps={{ step: "any" }}
                  />
                </Box>
                {manualInputError && (
                  <FormHelperText error sx={{ mb: 1.5, mt: -1 }}>
                    {manualInputError}
                  </FormHelperText>
                )}
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={handleSetManualTarget}
                  disabled={
                    !manualAirdropIndexJson ||
                    !manualObjectTypeJson ||
                    !manualLatitude ||
                    !manualLongitude
                  }
                  fullWidth
                >
                  Set Manual Target (Override)
                </Button>
                {/* === END MANUAL TARGET ENTRY SECTION === */}

                {/* === AUTOFILL DROP LOCATIONS SECTION === */}
                <Typography variant="subtitle1" gutterBottom>
                  Mission Data
                </Typography>
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={handleAutofillDropLocations}
                  fullWidth
                  sx={{ mb: 1.5 }}
                >
                  Autofill Targets from Mission
                </Button>
                <Typography
                  variant="caption"
                  display="block"
                  color="textSecondary"
                  sx={{ mb: 2, textAlign: "center" }}
                >
                  Loads drop location coordinates and object types from the submitted mission
                </Typography>
                {/* === END AUTOFILL SECTION === */}

                <Divider sx={{ my: 2 }} />
                <Button
                  variant="contained"
                  color="success"
                  fullWidth
                  onClick={handleFinalSubmit}
                  disabled={!canSubmitFinalMatches || isFinalSubmitting || isConfirming}
                  startIcon={
                    isFinalSubmitting ? <CircularProgress size={20} color="inherit" /> : null
                  }
                >
                  {isFinalSubmitting ? "Submitting..." : "Send Final Matches"}
                </Button>
                {error && isFinalSubmitting && (
                  <Alert severity="error" sx={{ mt: 1 }} onClose={() => setError(null)}>
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
                    (Requires all 4 targets confirmed with specific object types)
                  </Typography>
                )}
              </CardContent>
            </Card>

            {/* --- Match Detections Card --- */}
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
                    {currentDetections.map((detection, index) => {
                      const currentMatch = currentDetectionMatches[detection.compositeKey];
                      const assignedAirdropJsonValue =
                        currentMatch?.airdropIndex !== undefined &&
                        currentMatch.airdropIndex !== AirdropIndex.UNRECOGNIZED
                          ? airdropIndexToJSON(currentMatch.airdropIndex)
                          : "";
                      const assignedObjectTypeJsonValue =
                        currentMatch?.objectType !== undefined &&
                        currentMatch.objectType !== ODLCObjects.UNRECOGNIZED
                          ? oDLCObjectsToJSON(currentMatch.objectType)
                          : "";
                      const isDisabled = isConfirming || isFinalSubmitting || isCurrentRunProcessed;

                      return (
                        <Paper
                          key={detection.compositeKey}
                          elevation={2}
                          sx={{
                            p: 1.5,
                            opacity: isDisabled ? 0.6 : 1,
                            transition: "opacity 0.3s ease",
                            pointerEvents: isDisabled ? "none" : "auto",
                          }}
                        >
                          <Typography
                            variant="subtitle1"
                            gutterBottom
                            sx={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            {renderTargetLabel(index)}
                            <Typography component="span" variant="body2" color="text.secondary">
                              {formatCoordinates(detection.coordinate)}
                            </Typography>
                          </Typography>
                          <FormControl fullWidth size="small" sx={{ mb: 1 }} disabled={isDisabled}>
                            <InputLabel id={`a-${detection.compositeKey}`}>
                              Target Assignee
                            </InputLabel>
                            <Select
                              labelId={`a-${detection.compositeKey}`}
                              label="Target Assignee"
                              value={assignedAirdropJsonValue}
                              onChange={(e) =>
                                handleMatchUpdate(
                                  detection.compositeKey,
                                  "airdropIndex",
                                  e,
                                  detection,
                                )
                              }
                              displayEmpty
                              renderValue={(v) => v || <em>Assign ID...</em>}
                            >
                              <MenuItem value="">
                                <em>Clear Assignment</em>
                              </MenuItem>
                              {REQUIRED_AIRDROP_INDICES.map((idxEnum) => {
                                const v = airdropIndexToJSON(idxEnum);
                                const s = submittedTargets[idxEnum];
                                const isAlreadyConfirmed = s && s.Object !== ODLCObjects.Undefined;
                                return (
                                  <MenuItem
                                    key={v}
                                    value={v}
                                    sx={{
                                      color: isAlreadyConfirmed ? "text.secondary" : "inherit",
                                    }}
                                  >
                                    {v} {isAlreadyConfirmed ? "(Confirmed)" : ""}
                                  </MenuItem>
                                );
                              })}
                            </Select>
                            {assignedAirdropJsonValue &&
                              submittedTargets[airdropIndexFromJSON(assignedAirdropJsonValue)] &&
                              !isDisabled && (
                                <FormHelperText
                                  sx={{
                                    color: "orange.main",
                                  }}
                                >
                                  Will overwrite previously confirmed selection for this assignee.
                                </FormHelperText>
                              )}
                          </FormControl>
                          <FormControl
                            fullWidth
                            size="small"
                            sx={{ mb: 1 }}
                            disabled={isDisabled || !assignedAirdropJsonValue}
                          >
                            <InputLabel id={`o-${detection.compositeKey}`}>Object Type</InputLabel>
                            <Select
                              labelId={`o-${detection.compositeKey}`}
                              label="Object Type"
                              value={assignedObjectTypeJsonValue}
                              onChange={(e) =>
                                handleMatchUpdate(
                                  detection.compositeKey,
                                  "objectType",
                                  e,
                                  detection,
                                )
                              }
                              displayEmpty
                              renderValue={(v) => v || <em>Select Type...</em>}
                            >
                              <MenuItem value="">
                                <em>Undefined (Clear Type)</em>
                              </MenuItem>
                              {Object.entries(ODLCObjects)
                                .filter(
                                  ([_, v_enum]) =>
                                    typeof v_enum === "number" &&
                                    v_enum > 0 &&
                                    v_enum !== ODLCObjects.UNRECOGNIZED,
                                )
                                .map(([k_enum, v_enum]) => {
                                  const o_json = oDLCObjectsToJSON(v_enum as ODLCObjects);
                                  return (
                                    <MenuItem key={k_enum} value={o_json}>
                                      {o_json}
                                    </MenuItem>
                                  );
                                })}
                            </Select>
                          </FormControl>
                        </Paper>
                      );
                    })}
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
                        isConfirming ? <CircularProgress size={20} color="inherit" /> : null
                      }
                    >
                      {isCurrentRunProcessed
                        ? "Matches Confirmed"
                        : isConfirming
                          ? "Confirming..."
                          : "Confirm Image Matches"}
                    </Button>
                    {error && isConfirming && (
                      <Alert severity="error" sx={{ mt: 1 }} onClose={() => setError(null)}>
                        {error}
                      </Alert>
                    )}
                    <Button
                      variant="outlined"
                      onClick={handleNextImage}
                      disabled={
                        isConfirming ||
                        isFinalSubmitting ||
                        (currentRunIndex >= imageRuns.length - 1 && !isPollingUI)
                      }
                      fullWidth
                      sx={{ mt: 1 }}
                    >
                      {currentRunIndex >= imageRuns.length - 1
                        ? isPollingUI
                          ? "Waiting for New Images..."
                          : "End of Queue"
                        : "Next Image"}
                    </Button>
                  </Box>
                ) : (
                  <Typography color="textSecondary" sx={{ textAlign: "center", p: 3 }}>
                    {currentRun
                      ? "No detections in this image."
                      : imageRuns.length > 0
                        ? "Select a run from the queue."
                        : "No image runs available."}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Reports;
