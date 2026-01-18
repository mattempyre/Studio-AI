import React from 'react';
import * as Icons from '../Icons';
import { Button } from '../ui/button';

export const ConfirmModal: React.FC<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    danger?: boolean;
}> = ({
    isOpen,
    title,
    message,
    confirmText = 'Delete',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
    danger = true,
}) => {
        if (!isOpen) return null;

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black/80"
                    onClick={onCancel}
                />

                {/* Modal */}
                <div className="relative bg-surface-2 border border-border-color rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
                    <div className="flex items-center gap-3 mb-4">
                        <div className={`p-2 rounded-full ${danger ? 'bg-red-500/20' : 'bg-primary/20'}`}>
                            <Icons.AlertTriangle className={danger ? 'text-red-400' : 'text-primary'} size={20} />
                        </div>
                        <h3 className="text-lg font-bold text-white">{title}</h3>
                    </div>

                    <p className="text-text-muted mb-6">{message}</p>

                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={onCancel}>
                            {cancelText}
                        </Button>
                        <Button
                            variant={danger ? 'destructive' : 'default'}
                            onClick={onConfirm}
                        >
                            {confirmText}
                        </Button>
                    </div>
                </div>
            </div>
        );
    };
