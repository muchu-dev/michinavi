/** GPS座標を約250m四方の4分の1地域メッシュコードへ丸める。 */
export function toQuarterMeshCode(latitude: number, longitude: number) {
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

export function quarterMeshCodeToCenter(meshCode: string): [number, number] {
  if (!/^\d{10}$/.test(meshCode)) {
    throw new RangeError("10桁の4分の1地域メッシュコードが必要です");
  }

  // 投稿ピンは生のGPSではなく、保存されたメッシュ区画の中心へ置く。
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

function quadrant(latitudeFraction: number, longitudeFraction: number) {
  // 南西、南東、北西、北東を規格上の1、2、3、4へ変換する。
  const north = latitudeFraction >= 0.5 ? 2 : 0;
  const east = longitudeFraction >= 0.5 ? 1 : 0;
  return north + east + 1;
}
