import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { HttpError } from './validation.js';
export function imageUpload(uploadDir) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  });
  return [
    upload.single('image'),
    (req, res) => {
      const buffer = req.file?.buffer;
      if (!buffer) throw new HttpError(400, 'Chọn một ảnh PNG, JPG hoặc WebP.');
      const isPng = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const isJpg = buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
      const isWebp =
        buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
      const ext = isPng ? 'png' : isJpg ? 'jpg' : isWebp ? 'webp' : null;
      if (!ext) throw new HttpError(400, 'Chỉ nhận ảnh PNG, JPG hoặc WebP.');
      const filename = randomUUID() + '.' + ext;
      writeFileSync(path.join(uploadDir, filename), buffer, { flag: 'wx' });
      res.status(201).json({ imageUrl: '/uploads/' + filename });
    },
  ];
}
