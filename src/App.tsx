import {
  Carousel,
  CarouselSlideList,
  CarouselSlide,
  CarouselNext,
  CarouselPrevious
} from './Carousel'
import './App.css'

function App() {
  return (
    <div className="container">
      <div className="innerContainer">
        <Carousel>
          <CarouselSlideList className="carouselSlideList">
            {['1', '2', '3', '4', '5', '6'].map((item) => (
              <CarouselSlide key={item}>{item}</CarouselSlide>
            ))}
          </CarouselSlideList>
          <CarouselPrevious>PREV</CarouselPrevious>
          <CarouselNext>NEXT</CarouselNext>
        </Carousel>
      </div>
    </div>
  )
}

export default App
