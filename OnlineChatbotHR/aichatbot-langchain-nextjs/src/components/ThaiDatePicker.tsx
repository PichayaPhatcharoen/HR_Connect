"use client";

import React, { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { DayPicker } from "react-day-picker/buddhist";
import { th } from "react-day-picker/locale";

import "react-day-picker/style.css";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function isoToDate(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map((x) => Number(x));
  if (!y || !m || !d) return undefined;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

function dateToIso(date?: Date | null): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function formatIsoToBE(value?: string | null): string {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return "";
  const buddhistYear = Number(year) + 543;
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${buddhistYear}`;
}

export function ThaiDatePicker({
  value,
  onChange,
  disabled,
  required,
  allowClear,
  className,
  placeholder = "วว/ดด/ปปปป",
  dialogTitle = "เลือกวันที่",
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  allowClear?: boolean;
  className?: string;
  placeholder?: string;
  dialogTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => isoToDate(value), [value]);

  return (
    <>
      <div className="relative">
        <Input
          type="text"
          readOnly
          inputMode="numeric"
          pattern="^\\d{2}/\\d{2}/\\d{4}$"
          placeholder={placeholder}
          value={formatIsoToBE(value)}
          onClick={() => !disabled && setOpen(true)}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen(true);
            }
          }}
          className={cn("pr-10", className)}
          disabled={disabled}
          required={required}
          aria-haspopup="dialog"
          aria-expanded={open}
        />
        <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>

          <div className="flex justify-center">
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={(d) => {
                onChange(dateToIso(d ?? null));
                setOpen(false);
              }}
              locale={th}
              numerals="latn"
              defaultMonth={selected ?? new Date()}
              captionLayout="dropdown"
              showOutsideDays
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            {allowClear && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                ล้างวันที่
              </Button>
            )}
            <Button
              type="button"
              onClick={() => {
                onChange(dateToIso(new Date()));
                setOpen(false);
              }}
            >
              วันนี้
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              ปิด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

