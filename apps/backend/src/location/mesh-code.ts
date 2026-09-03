/**
 * 4分の1地域メッシュ（約250m四方）の変換ロジック。
 *
 * `apps/frontend`（feature/posts/db ブランチ）の
 * `src/lib/location/mesh-code.ts` と同じ計算式の移植である。
 * backend は frontend に依存できない（依存の向きは frontend -> backend -> db の
 * 一方向）ため、共有パッケージを新たに作るほどの規模でもない現時点では
 * 同じロジックをこのファイルへ複製する。将来どちらの実装も変更する場合は
 * 両方を揃えること。
 */

/** GPS座標を約250m四方の4分の1地域メッシュコードへ丸める。 */
export function toQuarterMeshCode(latitude: number, longitude: number): string {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < 0 ||
    latitude >= 66.6666667 ||
    longitude < 100 ||
    longitude >= 180
  ) {
    throw new RangeError("日本の標準地域メッシュへ変換できない座標です");
  }

  // 標準地域メッシュの規則に従い、1次、2次、3次、2分の1、4分の1の順で区画を求める。
  const latitudeIndex = latitude * 1.5;
  const primaryLatitude = Math.floor(latitudeIndex);
  const primaryLongitude = Math.floor(longitude) - 100;
  const secondaryLatitudeValue = (latitudeIndex - primaryLatitude) * 8;
  const secondaryLongitudeValue = (longitude - Math.floor(longitude)) * 8;
  const secondaryLatitude = Math.floor(secondaryLatitudeValue);
  const secondaryLongitude = Math.floor(secondaryLongitudeValue);
  const tertiaryLatitude = Math.floor(
    (secondaryLatitudeValue - secondaryLatitude) * 10,
  );
  const tertiaryLongitude = Math.floor(
    (secondaryLongitudeValue - secondaryLongitude) * 10,
  );
  const tertiaryLatitudeFraction =
    (secondaryLatitudeValue - secondaryLatitude) * 10 - tertiaryLatitude;
  const tertiaryLongitudeFraction =
    (secondaryLongitudeValue - secondaryLongitude) * 10 - tertiaryLongitude;
  const halfMesh = quadrant(
    tertiaryLatitudeFraction,
    tertiaryLongitudeFraction,
  );
  const quarterMesh = quadrant(
    (tertiaryLatitudeFraction * 2) % 1,
    (tertiaryLongitudeFraction * 2) % 1,
  );

  return [
    primaryLatitude.toString().padStart(2, "0"),
    primaryLongitude.toString().padStart(2, "0"),
    secondaryLatitude,
    secondaryLongitude,
    tertiaryLatitude,
    tertiaryLongitude,
    halfMesh,
    quarterMesh,
  ].join("");
}

/** メッシュコードから区画中心の緯度経度を求める。 */
export function quarterMeshCodeToCenter(meshCode: string): [number, number] {
  if (!/^\d{10}$/.test(meshCode)) {
    throw new RangeError("10桁の4分の1地域メッシュコードが必要です");
  }

  const digits = [...meshCode].map(Number);
  let latitude = Number(meshCode.slice(0, 2)) / 1.5;
  let longitude = Number(meshCode.slice(2, 4)) + 100;

  latitude += digits[4] / 12 + digits[6] / 120;
  longitude += digits[5] / 8 + digits[7] / 80;

  const halfMesh = digits[8];
  const quarterMesh = digits[9];
  if (![1, 2, 3, 4].includes(halfMesh) || ![1, 2, 3, 4].includes(quarterMesh)) {
    throw new RangeError("地域メッシュの分割区画は1から4で指定してください");
  }

  if (halfMesh >= 3) latitude += 1 / 240;
  if (halfMesh === 2 || halfMesh === 4) longitude += 1 / 160;
  if (quarterMesh >= 3) latitude += 1 / 480;
  if (quarterMesh === 2 || quarterMesh === 4) longitude += 1 / 320;

  return [latitude + 1 / 960, longitude + 1 / 640];
}

function quadrant(latitudeFraction: number, longitudeFraction: number): number {
  // 南西、南東、北西、北東を規格上の1、2、3、4へ変換する。
  const north = latitudeFraction >= 0.5 ? 2 : 0;
  const east = longitudeFraction >= 0.5 ? 1 : 0;
  return north + east + 1;
}

/** 4分の1地域メッシュ1区画の一辺（緯度・経度それぞれの角度差）。中心座標の再計算から求める */
const QUARTER_MESH_LATITUDE_HEIGHT = 1 / 480;
const QUARTER_MESH_LONGITUDE_WIDTH = 1 / 320;

/**
 * 隣接する4方向（北南東西）のメッシュコードを返す。
 *
 * 道路網データが無いため「隣接メッシュ = 実際に通行可能な隣」という保証は無い
 * （docs/er/05-route.md#経路を誰が作るか）。ここではあくまで格子の隣接区画を
 * 機械的に返すだけであり、実在する道でつながっているかどうかは判定できない。
 * 8方向（斜め）を含めないのは、斜め移動が両側の区画に阻まれていても
 * 通れるように見えてしまう「角抜け」を避けるため。
 */
export function neighborMeshCodes(meshCode: string): string[] {
  const [latitude, longitude] = quarterMeshCodeToCenter(meshCode);

  const offsets: [number, number][] = [
    [QUARTER_MESH_LATITUDE_HEIGHT, 0], // 北
    [-QUARTER_MESH_LATITUDE_HEIGHT, 0], // 南
    [0, QUARTER_MESH_LONGITUDE_WIDTH], // 東
    [0, -QUARTER_MESH_LONGITUDE_WIDTH], // 西
  ];

  const neighbors = new Set<string>();
  for (const [deltaLat, deltaLng] of offsets) {
    try {
      const code = toQuarterMeshCode(latitude + deltaLat, longitude + deltaLng);
      if (code !== meshCode) {
        neighbors.add(code);
      }
    } catch {
      // 日本のメッシュ範囲外に出た場合はその方向を無視する
    }
  }

  return [...neighbors];
}
