import Gallery, { GalleryType } from '../../models/Gallery';
import { CustomResponseType } from '@/types';

/**
 * Adds one or more images to the gallery.
 * @param data - The image data or an array of image data to add.
 */
const addImage = async (
  data:
    | {
        title: string;
        description?: string;
        imageUrl: string;
      }
    | {
        title: string;
        description?: string;
        imageUrl: string;
      }[]
): Promise<CustomResponseType<GalleryType[] | GalleryType>> => {
  try {
    if (Array.isArray(data)) {
      const newImages = await Gallery.insertMany(data);
      return {
        message: 'Images added to gallery successfully',
        data: newImages,
        code: 201,
      };
    } else {
      const newImage = new Gallery(data);
      await newImage.save();
      return {
        message: 'Image added to gallery successfully',
        data: newImage,
        code: 201,
      };
    }
  } catch (error) {
    console.error('Error adding image(s) to gallery:', error);
    return {
      message: 'Failed to add image(s) to gallery',
      data: null,
      code: 500,
    };
  }
};

// Get all images in the gallery
const getAllImages = async ({
  page = 1,
  limit = 30,
}): Promise<CustomResponseType<{ images: GalleryType[]; total: number; page: number; limit: number }>> => {
  try {
    const [images, totalImages] = await Promise.all([
      Gallery.find()
        .skip((page - 1) * limit)
        .limit(limit),
      Gallery.countDocuments(),
    ]);
    return {
      message: 'Images retrieved successfully',
      data: { images, total: totalImages, page, limit },
      code: 200,
    };
  } catch (error) {
    console.error('Error fetching images:', error);
    return {
      message: 'Failed to fetch images',
      data: null,
      code: 500,
    };
  }
};

/**
 * Deletes one or many images from the gallery.
 * @param imageIds - The ID or an array of IDs of the images to delete.
 */
const deleteImage = async (imageIds: string | string[]): Promise<CustomResponseType> => {
  try {
    if (Array.isArray(imageIds)) {
      const result = await Gallery.deleteMany({ _id: { $in: imageIds } });
      return {
        message: `${result.deletedCount} image(s) deleted successfully`,
        data: null,
        code: 200,
      };
    } else {
      const image = await Gallery.findByIdAndDelete(imageIds);
      if (!image) {
        return {
          message: 'Image not found',
          data: null,
          code: 404,
        };
      }
      return {
        message: 'Image deleted successfully',
        data: null,
        code: 200,
      };
    }
  } catch (error) {
    console.error('Error deleting image(s):', error);
    return {
      message: 'Failed to delete image(s)',
      data: null,
      code: 500,
    };
  }
};

/**
 * Updates the title and description of an image in the gallery.
 * @param imageId - The ID of the image to update.
 * @param updates - The updates to apply (title and/or description).
 */
const updateImage = async (
  image: string,
  updates: { title?: string; description?: string }
): Promise<CustomResponseType<GalleryType>> => {
  try {
    const updatedImage = await Gallery.findByIdAndUpdate(image, { ...updates });

    if (!updatedImage) {
      return {
        message: 'Image not found',
        data: null,
        code: 404,
      };
    }

    return {
      message: 'Image updated successfully',
      data: updatedImage,
      code: 200,
    };
  } catch (error) {
    console.error('Error updating image:', error);
    return {
      message: 'Failed to update image',
      data: null,
      code: 500,
    };
  }
};

const GalleryService = { addImage, getAllImages, deleteImage, updateImage };
export default GalleryService;
