"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { shouldBypassImageOptimization } from "@/lib/publicUploadedImage";

type Slide = { src: string; alt: string; link?: string | null };

const HomeImageSlide = ({ slides = [] }: { slides?: Slide[] }) => {
  const autoplay = useRef(Autoplay({ delay: 3000 }));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, [slides]);

  if (loading) {
    return (
      <div className="w-full mx-auto my-12">
        <div className="w-full aspect-video rounded-2xl animate-pulse bg-gray-200" />
      </div>
    );
  }

  const displaySlides =
    slides.length > 0
      ? slides
      : [
          {
            src: "/HR_LOGO.png",
            alt: "HR LOGO",
            link: null as string | null,
          },
        ];

  return (
    <Carousel
      opts={{ loop: true }}
      className="w-full mx-auto my-12"
      plugins={[autoplay.current]}
    >
      <CarouselContent>
        {displaySlides.map((image) => {
          const imageBlock = (
            <div className="relative w-full aspect-video overflow-hidden rounded-2xl">
              {/* Blurred layer: use <img> so every source (relative, absolute, external) loads */}
              <img
                src={image.src}
                alt=""
                className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-90"
                aria-hidden
              />
              {/* Sharp image contained inside; never cropped */}
              <Image
                src={image.src}
                alt={image.alt}
                fill
                priority
                sizes="100vw"
                className="object-contain"
                unoptimized={shouldBypassImageOptimization(image.src)}
              />
            </div>
          );
          return (
            <CarouselItem key={image.alt}>
              {image.link?.trim() ? (
                <a
                  href={image.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block cursor-pointer"
                >
                  {imageBlock}
                </a>
              ) : (
                imageBlock
              )}
            </CarouselItem>
          );
        })}
      </CarouselContent>
      <CarouselPrevious className="ml-16" />
      <CarouselNext className="mr-16" />
    </Carousel>
  );
};

export default HomeImageSlide;
