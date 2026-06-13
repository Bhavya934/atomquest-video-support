import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

const ALLOWED_MIME_TYPES = [
  // Images
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  // PDFs
  "application/pdf",
  // Word documents
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  // Excel sheets
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // Powerpoint presentations
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // Text & CSV
  "text/plain",
  "text/csv"
];

const ALLOWED_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".gif", ".webp",
  ".pdf",
  ".doc", ".docx",
  ".xls", ".xlsx",
  ".ppt", ".pptx",
  ".txt", ".csv"
];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const sessionId = formData.get("sessionId") as string;
    const shareToken = formData.get("shareToken") as string;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    // Verify session exists
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Allow uploads during active or waiting sessions
    if (session.status !== "active" && session.status !== "waiting") {
      return NextResponse.json({ error: "Uploads are only allowed during active sessions" }, { status: 400 });
    }

    // Verify authorization: either authenticated Agent (JWT cookie) or valid Customer (shareToken)
    const user = await getAuthUser();
    let isAuthorized = false;

    if (user) {
      if (session.agentId === user.id) {
        isAuthorized = true;
      }
    } else if (shareToken && session.shareToken === shareToken) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized upload" }, { status: 403 });
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File size exceeds the 10MB limit" }, { status: 400 });
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
    }

    // Validate file extension to be safe
    const originalName = file.name || "file";
    const ext = path.extname(originalName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ error: "File extension not allowed" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Secure filename against path traversal
    const safeName = path.basename(originalName).replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `${Date.now()}-${safeName}`;

    // Ensure session-specific uploads directory exists inside public folder
    const uploadDir = path.join(process.cwd(), "public", "uploads", sessionId);
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (err) {
      // Ignore if directory already exists
    }

    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, buffer);

    const fileUrl = `/uploads/${sessionId}/${filename}`;

    return NextResponse.json({
      url: fileUrl,
      name: originalName,
    });
  } catch (error: any) {
    console.error("File upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
