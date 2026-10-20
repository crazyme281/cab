import React, { useEffect, useState } from 'react';

interface PhotoUploadFieldProps {
  id?: string;
  label?: string;
  /** The currently saved image (edit mode). Ignored once a new file is picked or it's removed. */
  existingImageUrl?: string | null;
  /**
   * Called whenever the selection changes.
   * - A new file picked: (file, false)
   * - Cleared (no new file, existing image removed): (null, true)
   * - No selection made yet: never called with removed=true unless the user explicitly removes it
   */
  onChange: (file: File | null, removedExisting: boolean) => void;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

const PhotoUploadField: React.FC<PhotoUploadFieldProps> = ({
  id = 'photo',
  label = 'Photo (optional)',
  existingImageUrl = null,
  onChange,
}) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Revoke the local object URL when it's replaced or the component unmounts.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!selected) return;

    if (!ALLOWED_TYPES.includes(selected.type)) {
      setFileError('Please choose a JPG, PNG, or WEBP image');
      return;
    }
    if (selected.size > MAX_SIZE_BYTES) {
      setFileError('Image must be under 5MB');
      return;
    }

    setFileError(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(selected));
    setRemoved(false);
    onChange(selected, false);
  };

  const handleRemove = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setRemoved(true);
    onChange(null, true);
  };

  const displayImage = preview || (!removed ? existingImageUrl : null);

  return (
    <>
      <label className="auth-label" htmlFor={id}>{label}</label>
      {fileError && <p className="auth-error">{fileError}</p>}
      {displayImage ? (
        <div className="listing-photo-preview">
          <img src={displayImage} alt="Item preview" />
          <button
            type="button"
            className="listing-photo-remove"
            onClick={handleRemove}
            aria-label="Remove photo"
          >
            <i className="ti ti-x" aria-hidden="true"></i>
          </button>
        </div>
      ) : (
        <label className="listing-photo-dropzone" htmlFor={id}>
          <i className="ti ti-camera-plus" aria-hidden="true"></i>
          <span>Tap to add a photo</span>
        </label>
      )}
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="listing-photo-input"
      />
    </>
  );
};

export default PhotoUploadField;
