"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "./input";

declare global {
  interface Window {
    google?: {
      maps?: {
        places?: {
          AutocompleteService: new () => {
            getPlacePredictions: (
              req: { input: string; types?: string[] },
              cb: (predictions: Array<{ description: string; place_id: string }> | null) => void
            ) => void;
          };
        };
      };
    };
  }
}

type AddressAutocompleteProps = {
  value: string;
  onChange: (address: string) => void;
  placeholder?: string;
  className?: string;
};

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Enter an address",
  className,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isLoaded || !containerRef.current) return;
    const scriptId = "google-places-script";
    if (document.getElementById(scriptId)) {
      setIsLoaded(true);
      return;
    }
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    let checkCount = 0;
    const checkLoaded = () => {
      checkCount++;
      if (window.google?.maps?.places?.AutocompleteService) setIsLoaded(true);
      else if (checkCount < 50) setTimeout(checkLoaded, 100);
    };
    script.onload = checkLoaded;
    document.head.appendChild(script);
  }, [isLoaded]);

  const fetchSuggestions = useCallback((input: string) => {
    if (!input.trim() || input.trim().length < 3 || !window.google?.maps?.places?.AutocompleteService) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const service = new window.google.maps.places.AutocompleteService();
    service.getPlacePredictions(
      { input: input.trim(), types: ["address"] },
      (predictions) => {
        setSuggestions((predictions ?? []).map((p) => p.description));
        setOpen(true);
      }
    );
  }, []);

  useEffect(() => {
    if (!value.trim()) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, fetchSuggestions]);

  const selectAddress = useCallback(
    (address: string) => {
      onChange(address);
      setSuggestions([]);
      setOpen(false);
      inputRef.current?.blur();
    },
    [onChange]
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        type="text"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className={className}
      />
      {open && suggestions.length > 0 && (
        <div
          className="absolute z-[9999] mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 shadow-lg"
          role="listbox"
        >
          {suggestions.map((addr) => (
            <button
              key={addr}
              type="button"
              role="option"
              aria-selected={false}
              className="block w-full px-3 py-2.5 text-left text-sm text-zinc-100 hover:bg-zinc-800 first:rounded-t-md last:rounded-b-md"
              onClick={() => selectAddress(addr)}
            >
              {addr}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
