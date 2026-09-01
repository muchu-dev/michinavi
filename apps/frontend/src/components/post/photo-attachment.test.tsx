import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PhotoAttachment } from "./photo-attachment";

beforeAll(() => {
  // jsdom には実装が無い
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

afterEach(cleanup);

function photoFile(name: string, type: string, sizeBytes: number): File {
  const file = new File(["x"], name, { type });

  Object.defineProperty(file, "size", { value: sizeBytes });

  return file;
}

/** ラベルには記号も入るので、部分一致で引く */
function photoInput(): HTMLInputElement {
  return screen.getByLabelText(/写真を撮る/, {
    selector: "input",
  }) as HTMLInputElement;
}

function selectFile(file: File) {
  fireEvent.change(photoInput(), { target: { files: [file] } });
}

describe("PhotoAttachment", () => {
  it("背面カメラを直接開ける入力になっている", () => {
    render(<PhotoAttachment onChange={() => {}} />);

    const input = photoInput();

    expect(input.getAttribute("type")).toBe("file");
    expect(input.getAttribute("capture")).toBe("environment");
    // サーバ側が Exif を落とせる形式だけを受け取る
    expect(input.getAttribute("accept")).toBe("image/jpeg,image/png");
  });

  it("位置情報がサーバ側で削除されることを伝える", () => {
    render(<PhotoAttachment onChange={() => {}} />);

    expect(
      screen.getByText(
        "写真に含まれる位置情報は、送信後にサーバ側で削除されます。",
      ),
    ).toBeTruthy();
  });

  it("写真を選ぶとプレビューが出て、呼び出し元へ渡る", () => {
    const changes: unknown[] = [];
    render(<PhotoAttachment onChange={(photo) => changes.push(photo)} />);

    const file = photoFile("road.jpg", "image/jpeg", 1024);
    selectFile(file);

    expect(screen.getByRole("img").getAttribute("src")).toBe("blob:preview");
    expect(changes).toEqual([{ file, mimeType: "image/jpeg" }]);
  });

  it("写真を外すと元に戻る", () => {
    const changes: unknown[] = [];
    render(<PhotoAttachment onChange={(photo) => changes.push(photo)} />);

    selectFile(photoFile("road.jpg", "image/jpeg", 1024));
    fireEvent.click(screen.getByRole("button", { name: "写真を外す" }));

    expect(changes.at(-1)).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
    expect(photoInput()).toBeTruthy();
  });

  it("Exif を落とせない形式は受け取らない", () => {
    const changes: unknown[] = [];
    render(<PhotoAttachment onChange={(photo) => changes.push(photo)} />);

    selectFile(photoFile("photo.heic", "image/heic", 1024));

    expect(screen.getByRole("alert").textContent).toContain(
      "JPEG か PNG を選んでください",
    );
    expect(changes).toEqual([null]);
  });

  it("大きすぎる写真は送る前に断る", () => {
    const changes: unknown[] = [];
    render(<PhotoAttachment onChange={(photo) => changes.push(photo)} />);

    selectFile(photoFile("big.jpg", "image/jpeg", 6 * 1024 * 1024));

    expect(screen.getByRole("alert").textContent).toContain("5MB まで");
    expect(changes).toEqual([null]);
  });
});
