import { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  ImageList,
  ImageListItem,
  Button,
} from '@mui/material';

interface ImageSelectorProps {
  /** Array of image URLs extracted from the page. */
  images: string[];
  /** Currently selected image URL, or `null`. */
  selectedImage: string | null;
  /** Callback when an image is selected. */
  onSelect: (url: string | null) => void;
}

/** Maximum number of images to display in the grid. */
const MAX_IMAGES = 20;

/**
 * Thumbnail grid for selecting a product image.
 *
 * Displays up to 20 images in a 4-column grid. The selected image is
 * highlighted with a primary colour border. Broken images are hidden.
 * A "No image" button allows deselecting the current image.
 */
function ImageSelector({ images, selectedImage, onSelect }: ImageSelectorProps) {
  const [hiddenImages, setHiddenImages] = useState<Set<string>>(new Set());

  const handleImageError = useCallback((src: string) => {
    setHiddenImages((prev) => new Set(prev).add(src));
  }, []);

  const visibleImages = [...new Set(images)]
    .filter((src) => !hiddenImages.has(src))
    .slice(0, MAX_IMAGES);

  if (visibleImages.length === 0) {
    return (
      <Box sx={{ py: 1 }}>
        <Typography variant="body2" color="text.secondary">
          No images found on this page.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2" color="text.secondary">
          Select Image
        </Typography>
        {selectedImage && (
          <Button
            size="small"
            variant="text"
            onClick={() => onSelect(null)}
            sx={{ textTransform: 'none', fontSize: '0.75rem' }}
          >
            No image
          </Button>
        )}
      </Box>

      <ImageList cols={4} rowHeight={80} gap={6} sx={{ mt: 0, mb: 0 }}>
        {visibleImages.map((src) => (
          <ImageListItem
            key={src}
            onClick={() => onSelect(src)}
            sx={{
              cursor: 'pointer',
              borderRadius: 1,
              overflow: 'hidden',
              border: selectedImage === src
                ? '2px solid'
                : '2px solid transparent',
              borderColor: selectedImage === src ? 'primary.main' : 'transparent',
              transition: 'border-color 0.15s ease',
              '&:hover': {
                borderColor: selectedImage === src ? 'primary.main' : 'grey.300',
              },
            }}
          >
            <img
              src={src}
              alt=""
              loading="lazy"
              onError={() => handleImageError(src)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </ImageListItem>
        ))}
      </ImageList>
    </Box>
  );
}

export default ImageSelector;
