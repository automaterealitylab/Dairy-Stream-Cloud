import multer from "multer";

const storage = multer.memoryStorage();
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const imageFileFilter = (req, file, cb) => {
  const originalName = String(file?.originalname || "").toLowerCase();
  const extension = originalName.includes(".")
    ? originalName.slice(originalName.lastIndexOf("."))
    : "";

  if (!allowedMimeTypes.has(file?.mimetype) || !allowedExtensions.has(extension)) {
    return cb(new Error("Only JPG, PNG, and WEBP images are allowed"));
  }

  return cb(null, true);
};

export const uploadSingleImage = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
}).single("image");
