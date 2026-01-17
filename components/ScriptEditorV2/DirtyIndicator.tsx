import React from 'react';

export const DirtyIndicator: React.FC<{ isAudioDirty: boolean; isImageDirty: boolean; isVideoDirty: boolean }> = ({
    isAudioDirty,
    isImageDirty,
    isVideoDirty,
}) => {
    if (!isAudioDirty && !isImageDirty && !isVideoDirty) return null;

    return (
        <div className="flex items-center gap-1">
            {isAudioDirty && (
                <span className="size-1.5 rounded-full bg-orange-400" title="Audio needs regeneration" />
            )}
            {isImageDirty && (
                <span className="size-1.5 rounded-full bg-warning" title="Image needs regeneration" />
            )}
            {isVideoDirty && (
                <span className="size-1.5 rounded-full bg-pink-400" title="Video needs regeneration" />
            )}
        </div>
    );
};
