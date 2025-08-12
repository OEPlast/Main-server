import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import FileUpload, { IFileUpload } from '../models/FileUpload';
import { CustomResponseType } from '@/types';

interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination?: string;
  filename?: string;
  path?: string;
  buffer: Buffer;
}

// S3 Client Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const S3_BUCKET = process.env.AWS_S3_BUCKET || 'osl-ecommerce-bucket';

const uploadFile = async (
  file: UploadedFile,
  category: string,
  uploadedBy: string
): Promise<CustomResponseType<IFileUpload>> => {
  try {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const fileExtension = file.originalname.split('.').pop();
    const filename = `${file.fieldname}-${uniqueSuffix}.${fileExtension}`;
    const key = `${category}/${filename}`;

    // Upload to S3
    const uploadCommand = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        originalName: file.originalname,
        uploadedBy,
        category,
        uploadedAt: new Date().toISOString(),
      },
      ServerSideEncryption: 'AES256',
    });

    await s3Client.send(uploadCommand);

    // Generate S3 URL
    const s3Url = `https://${S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

    // Create database record
    const fileRecord = new FileUpload({
      filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: s3Url,
      s3Key: key,
      category,
      uploadedBy,
      metadata: {
        format: fileExtension,
        s3Bucket: S3_BUCKET,
        s3Region: process.env.AWS_REGION || 'us-east-1',
      },
    });

    await fileRecord.save();

    return {
      message: 'File uploaded successfully to S3',
      data: fileRecord,
      code: 201,
    };
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    return {
      message: 'Failed to upload file to S3',
      data: null,
      code: 500,
    };
  }
};

const uploadMultipleFiles = async (
  files: UploadedFile[],
  category: string,
  uploadedBy: string
): Promise<CustomResponseType<IFileUpload[]>> => {
  try {
    const uploadedFiles: IFileUpload[] = [];

    for (const file of files) {
      const result = await uploadFile(file, category, uploadedBy);
      if (result.data) {
        uploadedFiles.push(result.data);
      }
    }

    return {
      message: `${uploadedFiles.length} files uploaded successfully to S3`,
      data: uploadedFiles,
      code: 201,
    };
  } catch (error) {
    console.error('Error uploading multiple files to S3:', error);
    return {
      message: 'Failed to upload files to S3',
      data: null,
      code: 500,
    };
  }
};

const getFilesByCategory = async (
  category: string,
  page = 1,
  limit = 20
): Promise<CustomResponseType<{ files: IFileUpload[]; total: number; page: number; limit: number }>> => {
  try {
    const [files, total] = await Promise.all([
      FileUpload.find({ category })
        .populate('uploadedBy', 'name email')
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 }),
      FileUpload.countDocuments({ category }),
    ]);

    return {
      message: 'Files retrieved successfully',
      data: { files, total, page, limit },
      code: 200,
    };
  } catch (error) {
    console.error('Error getting files by category:', error);
    return {
      message: 'Failed to retrieve files',
      data: null,
      code: 500,
    };
  }
};

const deleteFile = async (fileId: string): Promise<CustomResponseType> => {
  try {
    const file = await FileUpload.findById(fileId);
    if (!file) {
      return {
        message: 'File not found',
        data: null,
        code: 404,
      };
    }

    // Delete from S3
    if (file.s3Key) {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: file.s3Key,
      });

      await s3Client.send(deleteCommand);
    }

    // Delete database record
    await FileUpload.findByIdAndDelete(fileId);

    return {
      message: 'File deleted successfully from S3',
      data: null,
      code: 200,
    };
  } catch (error) {
    console.error('Error deleting file from S3:', error);
    return {
      message: 'Failed to delete file from S3',
      data: null,
      code: 500,
    };
  }
};

const FileUploadService = {
  uploadFile,
  uploadMultipleFiles,
  getFilesByCategory,
  deleteFile,
};

export default FileUploadService;
