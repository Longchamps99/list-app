"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Props {
    id: string;
    children: (dragHandleProps: any) => React.ReactNode;
}

export function SortableItem({ id, children }: Props) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        touchAction: "none", // Prevent scroll on touch devices while dragging (if handle logic fits)
        // If handle is small, touch-action might need tuning. 
        // For general safety usually 'none' on the dragger.
    };

    // We pass combined props (listeners + attributes) to the render function
    // The child can spread these onto the Handle element.
    const dragHandleProps = { ...attributes, ...listeners };

    return (
        <div ref={setNodeRef} style={style} className="h-full">
            {children(dragHandleProps)}
        </div>
    );
}
