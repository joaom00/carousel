import React from 'react'
import debounce from 'lodash.debounce'
import { useCallbackRef } from './hooks/use-callback-ref'
import { createContext } from './util/createContext'
import { useComposedRefs } from './hooks/use-compose-refs'
import { composeEventHandlers } from './util/composeEventHandlers'

const [CarouselProvider, useCarouselContext] = createContext<{
  slideListRef: React.RefObject<HTMLDivElement>
  currentPos: number
  onNextClick(): number | undefined
  onPrevClick(): number | undefined
  nextDisabled: boolean
  prevDisabled: boolean
}>('Carousel')

interface CarouselProps {
  children: React.ReactNode
}

export const Carousel = (props: CarouselProps) => {
  const ref = React.useRef<React.ElementRef<'div'>>(null)
  const currentPos = React.useRef(0)
  const [position, setPosition] = React.useState(0)
  const { children, ...carouselProps } = props
  const slideListRef = React.useRef<HTMLDivElement>(null)
  const [, force] = React.useState({})
  const [nextDisabled, setNextDisabled] = React.useState(false)
  const [prevDisabled, setPrevDisabled] = React.useState(true)
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout>>()
  const navigationUpdateDelay = React.useRef(100)

  const getSlides = useCallbackRef((direction: 1 | -1) => {
    const slides = ref.current?.querySelectorAll<HTMLElement>('[data-slide-intersection-ratio]')
    if (!slides?.length) {
      return null
    }
    const currentSlide = slides[position].getBoundingClientRect()
    const nextSlide = slides[position + direction].getBoundingClientRect()
    return [currentSlide, nextSlide] as const
  })

  const getSlideInDirection = useCallbackRef((direction: 1 | -1) => {
    const slides = ref.current?.querySelectorAll<HTMLElement>('[data-slide-intersection-ratio]')
    if (slides) {
      const slidesArray = Array.from(slides.values())

      if (direction === 1) {
        slidesArray.reverse()
      }

      return slidesArray.find((slide) => slide.dataset.slideIntersectionRatio !== '0')
    }
  })
  // slideListRef.current.scrollTo({ left: nextElementRect.x - currentElementRect.x, behavior: 'smooth' })
  const handleNextClick = React.useCallback(() => {
    const slides = getSlides(1)
    if (slides) {
      const [currentSlide, nextSlide] = slides
      const nextPos = nextSlide.x - currentSlide.x
      slideListRef.current?.scrollTo({ left: nextPos * (position + 1), behavior: 'smooth' })
      setPosition((currentPosition) => currentPosition + 1)
      return nextPos
    }
  }, [position, getSlides])

  const handlePrevClick = React.useCallback(() => {
    const slides = getSlides(-1)
    if (slides) {
      const [currentSlide, nextSlide] = slides
      const nextPos = currentSlide.x - nextSlide.x
      console.log('position', position - 2)
      console.log('nextPos', nextPos)
      slideListRef.current?.scrollTo({ left: nextPos * (position + 1 - 2), behavior: 'smooth' })
      setPosition((currentPosition) => currentPosition - 1)
      return nextPos
    }
  }, [position, getSlides])

  React.useEffect(() => {
    // Keep checking for whether we need to disable the navigation buttons, debounced
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      requestAnimationFrame(() => {
        if (slideListRef.current) {
          const { scrollLeft, scrollWidth, clientWidth } = slideListRef.current
          setPrevDisabled(scrollLeft <= 0)
          setNextDisabled(scrollWidth - scrollLeft - clientWidth <= 0)
          navigationUpdateDelay.current = 100
        }
      })
    }, navigationUpdateDelay.current)
  })

  React.useEffect(() => {
    const slidesList = slideListRef.current
    if (slidesList) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const handleScrollStartAndEnd = debounce(() => force({}), 100, {
        leading: true,
        trailing: true
      })
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      slidesList.addEventListener('scroll', handleScrollStartAndEnd)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      window.addEventListener('resize', handleScrollStartAndEnd)
      force({})
      return () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        slidesList.removeEventListener('scroll', handleScrollStartAndEnd)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        window.removeEventListener('resize', handleScrollStartAndEnd)
      }
    }
  }, [slideListRef])

  return (
    <CarouselProvider
      currentPos={currentPos.current}
      nextDisabled={nextDisabled}
      prevDisabled={prevDisabled}
      slideListRef={slideListRef}
      onNextClick={handleNextClick}
      onPrevClick={handlePrevClick}
    >
      <div {...carouselProps} ref={ref}>
        {props.children}
      </div>
    </CarouselProvider>
  )
}

type CarouselSlideListProps = React.ComponentPropsWithRef<'div'>

interface DragStart {
  scrollX: number
  pointerX: number
}

export const CarouselSlideList = (props: CarouselSlideListProps) => {
  const context = useCarouselContext('CarouselSlideList')
  const ref = React.useRef<HTMLDivElement>(null)
  const composedRefs = useComposedRefs(ref, context.slideListRef)
  const [dragStart, setDragStart] = React.useState<DragStart>({ scrollX: 0, pointerX: 0 })

  const handleMouseMove = useCallbackRef((event: MouseEvent) => {
    if (ref.current) {
      const distanceX = event.clientX - dragStart.pointerX
      console.log('distanceX', distanceX)
      ref.current.scrollLeft = dragStart.scrollX - distanceX
    }
  })

  const handleMouseUp = useCallbackRef((event: MouseEvent) => {
    if (ref.current) {
      const distanceX = event.clientX - dragStart.pointerX
      if (distanceX <= -100) {
        const nextPos = context.onNextClick()
        ref.current.scrollTo({ left: nextPos, behavior: 'smooth' })
      } else if (distanceX >= 100) {
        const nextPos = context.onPrevClick()
        ref.current.scrollTo({ left: nextPos, behavior: 'smooth' })
      } else {
        ref.current.scrollTo({ left: context.currentPos, behavior: 'smooth' })
      }
    }
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    setDragStart({ scrollX: 0, pointerX: 0 })
  })

  return (
    <div
      {...props}
      ref={composedRefs}
      onMouseDownCapture={composeEventHandlers(
        props.onMouseDownCapture,
        (event: React.MouseEvent) => {
          if (event.button === 0) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
            setDragStart({
              scrollX: (event.currentTarget as HTMLElement).scrollLeft,
              pointerX: event.clientX
            })
          }
        }
      )}
      onPointerDown={composeEventHandlers(props.onPointerDown, (event: React.PointerEvent) => {
        const element = event.target as HTMLElement
        element.style.userSelect = 'none'
        element.setPointerCapture(event.pointerId)
      })}
      onPointerUp={composeEventHandlers(props.onPointerUp, (event: React.PointerEvent) => {
        const element = event.target as HTMLElement
        element.style.userSelect = ''
        element.releasePointerCapture(event.pointerId)
      })}
    />
  )
}

type CarouselSlideProps = React.ComponentPropsWithRef<'div'>
export const CarouselSlide = (props: CarouselSlideProps) => {
  const context = useCarouselContext('CarouselSlide')
  const ref = React.useRef<HTMLDivElement>(null)
  const [intersectionRatio, setIntersectionRatio] = React.useState(0)
  const isDraggingRef = React.useRef(false)

  React.useEffect(() => {
    if (ref.current) {
      const observer = new IntersectionObserver(
        ([entry]) => setIntersectionRatio(entry.intersectionRatio),
        { root: context.slideListRef.current, threshold: [0, 0.5, 1] }
      )
      observer.observe(ref.current)
      return () => observer.disconnect()
    }
  }, [context.slideListRef])

  return (
    <div
      {...props}
      ref={ref}
      data-slide-intersection-ratio={intersectionRatio}
      onDragStart={(event) => {
        event.preventDefault()
        isDraggingRef.current = true
      }}
      onClick={(event) => {
        if (isDraggingRef.current) {
          event.preventDefault()
        }
      }}
    />
  )
}

type CarouselNextProps = React.ComponentPropsWithRef<'button'>
export const CarouselNext = (props: CarouselNextProps) => {
  const context = useCarouselContext('CarouselNext')
  return <button {...props} onClick={() => context.onNextClick()} disabled={context.nextDisabled} />
}

type CarouselPreviousProps = React.ComponentPropsWithRef<'button'>
export const CarouselPrevious = (props: CarouselPreviousProps) => {
  const context = useCarouselContext('CarouselPrevious')
  return <button {...props} onClick={() => context.onPrevClick()} disabled={context.prevDisabled} />
}
