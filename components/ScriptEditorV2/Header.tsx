import React from 'react';
import * as Icons from '../Icons';
import { Button } from '../ui/button';

interface HeaderProps {
    isEditingName: boolean;
    editNameValue: string;
    setEditNameValue: (value: string) => void;
    onKeyDownName: (e: React.KeyboardEvent) => void;
    onBlurName: () => void;
    onClickName: () => void;
    displayName: string;
    onUpdateProjectName?: () => Promise<void>;
    sectionCount: number;
    sentenceCount: number;
    isSaving: boolean;
    onNext: () => void;
}

export const Header: React.FC<HeaderProps> = ({
    isEditingName,
    editNameValue,
    setEditNameValue,
    onKeyDownName,
    onBlurName,
    onClickName,
    displayName,
    onUpdateProjectName,
    sectionCount,
    sentenceCount,
    isSaving,
    onNext,
}) => {
    return (
        <div className="px-8 py-6 border-b border-border-color bg-background-dark/60">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
                <div className="group">
                    {isEditingName ? (
                        <input
                            type="text"
                            value={editNameValue}
                            onChange={(e) => setEditNameValue(e.target.value)}
                            onKeyDown={onKeyDownName}
                            onBlur={onBlurName}
                            className="text-xl font-bold text-white bg-transparent border-b border-primary focus:outline-none w-full"
                            aria-label="Project name"
                            autoFocus
                        />
                    ) : (
                        <div className="flex items-center gap-2">
                            <h1
                                className="text-xl font-bold text-white cursor-pointer hover:text-primary transition-colors"
                                onClick={onClickName}
                                title="Click to edit project name"
                            >
                                {displayName}
                            </h1>
                            {onUpdateProjectName && (
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={onClickName}
                                    className="opacity-0 group-hover:opacity-100"
                                    title="Rename Project"
                                    aria-label="Rename project"
                                >
                                    <Icons.Edit3 size={14} />
                                </Button>
                            )}
                        </div>
                    )}
                    <p className="text-sm text-text-muted mt-1">
                        {sectionCount} section{sectionCount !== 1 ? 's' : ''} •{' '}
                        {sentenceCount} sentences
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    {isSaving && (
                        <span className="text-xs text-text-muted flex items-center gap-2">
                            <Icons.RefreshCw className="animate-spin" size={12} />
                            Saving...
                        </span>
                    )}
                    <Button onClick={onNext}>
                        Continue to Storyboard
                        <Icons.ChevronRight size={16} />
                    </Button>
                </div>
            </div>
        </div>
    );
};
