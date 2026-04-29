import { NextResponse, type NextRequest } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/user";
import {
  ensureContainer,
  ensureImage,
  getInfo,
  recreateContainer,
  removeContainer,
  SandboxImageMissingError,
  SANDBOX_IMAGE,
  type NetworkMode,
} from "@/lib/docker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ActionPayload = {
  action?: "start" | "restart";
  networkMode?: NetworkMode;
};

function errorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (err instanceof SandboxImageMissingError) {
    return NextResponse.json(
      { error: "sandbox_image_missing", message: err.message },
      { status: 503 },
    );
  }
  console.error("[api/shell] unexpected:", err);
  return NextResponse.json({ error: "internal_error" }, { status: 500 });
}

function sanitizeMode(raw: unknown): NetworkMode | undefined {
  if (raw === "none" || raw === "bridge") return raw;
  return undefined;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    let imageReady = true;
    try {
      await ensureImage();
    } catch (err) {
      if (err instanceof SandboxImageMissingError) imageReady = false;
      else throw err;
    }
    const info = imageReady
      ? await getInfo(user.id)
      : { status: "absent" as const, networkMode: null, containerName: null };
    return NextResponse.json({
      image: SANDBOX_IMAGE,
      imageReady,
      ...info,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body: ActionPayload = await request.json().catch(() => ({}));
    const action = body.action ?? "start";
    const desiredMode = sanitizeMode(body.networkMode);

    if (action === "restart") {
      // 既存があれば削除して指定 mode で再作成。Volume は維持。
      await recreateContainer(user.id, { networkMode: desiredMode ?? "bridge" });
    } else if (action === "start") {
      await ensureContainer(user.id, { networkMode: desiredMode ?? "bridge" });
    } else {
      return NextResponse.json({ error: "invalid_action" }, { status: 400 });
    }
    return NextResponse.json(await getInfo(user.id));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser(request);
    await removeContainer(user.id, { force: true });
    return NextResponse.json(await getInfo(user.id));
  } catch (err) {
    return errorResponse(err);
  }
}
