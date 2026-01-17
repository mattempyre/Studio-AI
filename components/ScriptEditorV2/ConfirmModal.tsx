import React from 'react';
import * as Icons from '../Icons';

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
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-bold text-text-muted hover:text-white transition-colors"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${danger
                                ? 'bg-red-500 hover:bg-red-600 text-white'
                                : 'bg-primary hover:bg-primary/80 text-white'
                                }`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        );
    };
