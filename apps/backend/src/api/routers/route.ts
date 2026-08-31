import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { neighborMeshCodes, toQuarterMeshCode } from "../../location/mesh-code";
import { toTRPCError } from "../errors";
import type { TRPCContext } from "../init";
import { createTRPCRouter, publicProcedure } from "../init";

const coordinateSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

const suggestInputSchema = z.object({
  origin: coordinateSchema,
  destination: coordinateSchema,
});

/** 探索の暴走を防ぐ上限。この件数を超えて広げても目的地に届かなければ諦める */
const MAX_VISITED_MESHES = 2000;

const DISCLAIMER =
  "メッシュ単位の目安であり、実際の道路のつながりを保証するものではありません";

type RoadCondition = "passable" | "caution" | "impassable";
type StatusLookup = Map<string, RoadCondition>;

/** 座標をメッシュコードへ変換する。範囲外の座標は BAD_REQUEST にする */
function encodeMeshCode(coordinate: {
  latitude: number;
  longitude: number;
}): string {
  try {
    return toQuarterMeshCode(coordinate.latitude, coordinate.longitude);
  } catch (err) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        err instanceof Error ? err.message : "座標をメッシュへ変換できません",
    });
  }
}

async function fetchStatuses(
  supabase: TRPCContext["supabase"],
): Promise<StatusLookup> {
  const { data, error } = await supabase
    .from("road_status_estimates")
    .select("mesh_code, road_condition");

  if (error) {
    throw toTRPCError(error, "道路状態の取得に失敗しました");
  }

  const lookup: StatusLookup = new Map();
  for (const row of data) {
    lookup.set(row.mesh_code, row.road_condition);
  }
  return lookup;
}

/**
 * 出発メッシュから目的地メッシュまで、通れないメッシュを避けて幅優先探索する。
 * 隣接メッシュは neighborMeshCodes（機械的な格子の隣接）だけを根拠にする。
 * 実在する道でつながっているかどうかは判定できない
 * （docs/er/05-route.md#経路を誰が作るか）。
 */
function findMeshPath(
  originMeshCode: string,
  destinationMeshCode: string,
  statuses: StatusLookup,
): string[] | null {
  if (statuses.get(originMeshCode) === "impassable") {
    return null;
  }

  if (originMeshCode === destinationMeshCode) {
    return [originMeshCode];
  }

  const visited = new Set<string>([originMeshCode]);
  const cameFrom = new Map<string, string>();
  const queue: string[] = [originMeshCode];

  for (let head = 0; head < queue.length; head += 1) {
    if (visited.size > MAX_VISITED_MESHES) {
      return null;
    }

    const current = queue[head];
    if (!current) break;

    for (const neighbor of neighborMeshCodes(current)) {
      if (visited.has(neighbor) || statuses.get(neighbor) === "impassable") {
        continue;
      }

      visited.add(neighbor);
      cameFrom.set(neighbor, current);

      if (neighbor === destinationMeshCode) {
        return reconstructPath(cameFrom, originMeshCode, destinationMeshCode);
      }

      queue.push(neighbor);
    }
  }

  return null;
}

function reconstructPath(
  cameFrom: ReadonlyMap<string, string>,
  originMeshCode: string,
  destinationMeshCode: string,
): string[] {
  const path: string[] = [destinationMeshCode];
  let current = destinationMeshCode;

  while (current !== originMeshCode) {
    const previous = cameFrom.get(current);
    if (!previous) break;
    path.push(previous);
    current = previous;
  }

  return path.reverse();
}

export const routeRouter = createTRPCRouter({
  /**
   * 出発地と目的地から、メッシュ単位のおおまかな経路を返す（BE-20 MVP）。
   *
   * これは道路網データを持たないための近似であり、道路レベルの経路案内ではない。
   * 隣接するメッシュを通れる限りつないでいるだけで、実在する道が
   * 実際につながっているかどうかは判定できない
   * （docs/er/05-route.md#経路を誰が作るか）。
   */
  suggest: publicProcedure
    .input(suggestInputSchema)
    .query(async ({ ctx, input }) => {
      const originMeshCode = encodeMeshCode(input.origin);
      const destinationMeshCode = encodeMeshCode(input.destination);

      const statuses = await fetchStatuses(ctx.supabase);
      const path = findMeshPath(originMeshCode, destinationMeshCode, statuses);

      if (!path) {
        return {
          found: false as const,
          originMeshCode,
          destinationMeshCode,
          path: [],
          disclaimer: DISCLAIMER,
        };
      }

      return {
        found: true as const,
        originMeshCode,
        destinationMeshCode,
        path: path.map((meshCode) => ({
          meshCode,
          roadCondition: statuses.get(meshCode) ?? null,
        })),
        hopCount: path.length - 1,
        disclaimer: DISCLAIMER,
      };
    }),
});
