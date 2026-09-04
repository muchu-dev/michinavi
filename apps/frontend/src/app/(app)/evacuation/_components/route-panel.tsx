"use client";

import { useState } from "react";
import { MapView } from "@/components/map/map-view";
import { api } from "@/lib/trpc/client";
import { ChoicePanel } from "./choice-panel";
import {
  evacuationDemoLocation,
  nearbyShelterRadiusM,
} from "./evacuation-demo";

type Location = {
  latitude: number;
  longitude: number;
};

// 地図の下に、BE-19が生成した避難方法と切り替え基準を表示する。
export function RoutePanel({ isActive = true }: { isActive?: boolean }) {
  const [mapLocation, setMapLocation] = useState<Location | null>(null);
  const [locationMode, setLocationMode] = useState<"actual" | "demo" | null>(
    null,
  );
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const assignmentMutation = api.shelterAssignment.assign.useMutation();

  const assignShelterFrom = (location: Location) => {
    assignmentMutation.mutate({
      ...location,
      radiusM: nearbyShelterRadiusM,
      candidateLimit: 10,
    });
  };

  const useDemoLocation = () => {
    setMapLocation(evacuationDemoLocation);
    setLocationMode("demo");
    setLocationError(null);
    assignShelterFrom(evacuationDemoLocation);
  };

  const useCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocationError("この端末では位置情報を利用できません。");
      return;
    }

    setIsLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setMapLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        setLocationMode("actual");
        setIsLocating(false);
        assignShelterFrom({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
      },
      () => {
        setLocationError("現在地を取得できませんでした。");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  return (
    <>
      <div className="relative h-[19rem] shrink-0 overflow-hidden border-b border-outline">
        <MapView
          currentLocation={mapLocation}
          isVisible={isActive}
          locationLabel={
            locationMode === "demo" ? "デモ位置（真備町箭田）" : undefined
          }
          showLocationControl={false}
          fillContainer
        />
      </div>
      <div className="border-b border-outline bg-surface px-3 py-2">
        <div className="flex justify-end">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={useDemoLocation}
              disabled={isLocating || assignmentMutation.isPending}
              className="inline-flex min-h-11 items-center rounded-full border border-brand bg-brand/10 px-3 text-[0.6875rem] font-black text-brand disabled:opacity-60"
            >
              デモ位置
            </button>
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={isLocating || assignmentMutation.isPending}
              className="inline-flex min-h-11 items-center rounded-full border border-outline bg-surface px-3 text-[0.6875rem] font-black text-muted disabled:opacity-60"
            >
              {isLocating ? "現在地取得中" : "現在地"}
            </button>
          </div>
        </div>
        {locationError && (
          <p
            role="alert"
            className="mt-1 text-[0.6875rem] font-bold text-impassable"
          >
            {locationError}
          </p>
        )}
      </div>
      <ChoicePanel
        isActive={isActive}
        assignedShelter={assignmentMutation.data}
        isAssigningShelter={assignmentMutation.isPending}
        shelterAssignmentError={assignmentMutation.error}
      />
    </>
  );
}
