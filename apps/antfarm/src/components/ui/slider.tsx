import * as React from "react";

import { cn } from "@/lib/utils";

interface SliderProps extends Omit<React.ComponentProps<"input">, "type" | "onChange" | "value"> {
  value?: number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
}

function Slider({
  className,
  value = [0],
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  ...props
}: SliderProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    onValueChange?.([newValue]);
  };

  const percentage = ((value[0] - min) / (max - min)) * 100;

  return (
    <div className={cn("relative flex w-full touch-none select-none items-center", className)}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value[0]}
        onChange={handleChange}
        disabled={disabled}
        className={cn(
          "w-full h-1.5 appearance-none cursor-pointer rounded-full",
          "bg-primary/20",
          "[&::-webkit-slider-thumb]:appearance-none",
          "[&::-webkit-slider-thumb]:h-4",
          "[&::-webkit-slider-thumb]:w-4",
          "[&::-webkit-slider-thumb]:rounded-full",
          "[&::-webkit-slider-thumb]:bg-primary",
          "[&::-webkit-slider-thumb]:border-2",
          "[&::-webkit-slider-thumb]:border-background",
          "[&::-webkit-slider-thumb]:shadow-sm",
          "[&::-webkit-slider-thumb]:transition-all",
          "[&::-webkit-slider-thumb]:ring-offset-background",
          "[&::-webkit-slider-thumb]:focus-visible:ring-2",
          "[&::-webkit-slider-thumb]:focus-visible:ring-ring",
          "[&::-webkit-slider-thumb]:focus-visible:ring-offset-2",
          "[&::-webkit-slider-thumb]:hover:scale-110",
          "[&::-moz-range-thumb]:h-4",
          "[&::-moz-range-thumb]:w-4",
          "[&::-moz-range-thumb]:rounded-full",
          "[&::-moz-range-thumb]:bg-primary",
          "[&::-moz-range-thumb]:border-2",
          "[&::-moz-range-thumb]:border-background",
          "[&::-moz-range-thumb]:shadow-sm",
          "[&::-moz-range-thumb]:transition-all",
          "disabled:pointer-events-none disabled:opacity-50",
          "focus-visible:outline-none"
        )}
        style={{
          background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${percentage}%, hsl(var(--primary) / 0.2) ${percentage}%, hsl(var(--primary) / 0.2) 100%)`,
        }}
        {...props}
      />
    </div>
  );
}

export { Slider };
