import React, { useEffect, useState } from "react"
import {
  ComponentProps,
  Streamlit,
  withStreamlitConnection,
} from "streamlit-component-lib"
import { fabric } from "fabric"
import { isEqual } from "lodash"

import CanvasToolbar from "./components/CanvasToolbar"
import UpdateStreamlit from "./components/UpdateStreamlit"

import { useCanvasState } from "./DrawableCanvasState"
import { tools, FabricTool } from "./lib"

/**
 * Arguments Streamlit receives from the Python side
 */
export interface PythonArgs {
  fillColor: string
  strokeWidth: number
  strokeColor: string
  backgroundColor: string
  backgroundImageURL: string
  realtimeUpdateStreamlit: boolean
  canvasWidth: number
  canvasHeight: number
  drawingMode: string
  initialDrawing: Object
  displayToolbar: boolean
  displayRadius: number
}

/**
 * Define logic for the canvas area
 */
const DrawableCanvas = ({ args }: ComponentProps) => {
  const {
    canvasWidth,
    canvasHeight,
    backgroundColor,
    backgroundImageURL,
    realtimeUpdateStreamlit,
    drawingMode,
    fillColor,
    strokeWidth,
    strokeColor,
    displayRadius,
    initialDrawing,
    displayToolbar,
  }: PythonArgs = args

  /**
   * State initialization
   */
  const [canvas, setCanvas] = useState(new fabric.Canvas(""))
  canvas.stopContextMenu = true
  canvas.fireRightClick = true
  if (strokeWidth <= 10) {
    canvas.freeDrawingCursor = 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKBAMAAAB/HNKOAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAAkUExURf/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP///4U2E3cAAAALdFJOUwADKFNkKTViZ2ZjlZ/ccgAAAAFiS0dECx/XxMAAAAAHdElNRQfnBgYGLgRlWZphAAAANklEQVQI12NgVHYxFWAQq5jZnsig3jlzxlIGi5kzZzYzeALJKVASIhIFlhVbMbMrkYExGKgLAHKdFXfIvcXXAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDIzLTA2LTA2VDA2OjQ1OjU2KzAwOjAwJoz1AAAAACV0RVh0ZGF0ZTptb2RpZnkAMjAyMy0wNi0wNlQwNjo0NTo1NiswMDowMFfRTbwAAAAodEVYdGRhdGU6dGltZXN0YW1wADIwMjMtMDYtMDZUMDY6NDY6MDQrMDA6MDA0jMgtAAAAAElFTkSuQmCC) 5 5, auto';
  }
  else if (strokeWidth <= 20)
  {
    canvas.freeDrawingCursor = 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAMAAAC6V+0/AAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAA/UExURQAAAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP///1HjDDAAAAAUdFJOUwAADCxLXWVMLQMmU2dmBjljJ146ZzO6KQAAAAFiS0dEFJLfyTUAAAAHdElNRQfnBgYGKywtm8beAAAAhElEQVQY023RWw7EIAgFULAVRbG+9r/XqkkzY8v98yREvALgiDlOS2SdN/ME0zhEkjQiFANPRbxyWbS45Gsi57Ql88BQdiwVwUTZUaKBg9Ir5OGUN4oDmz5pQF8kHdVxp13ktZXU5bEqz0TuO3Ze1fX/6vqqbpRcfyVXfqpH410jas933J6GENhGzPYgAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDIzLTA2LTA2VDA2OjQzOjEzKzAwOjAw/eCkGgAAACV0RVh0ZGF0ZTptb2RpZnkAMjAyMy0wNi0wNlQwNjo0MzoxMyswMDowMIy9HKYAAAAodEVYdGRhdGU6dGltZXN0YW1wADIwMjMtMDYtMDZUMDY6NDM6NDQrMDA6MDBW7w2TAAAAAElFTkSuQmCC) 10 10, auto';
  }
  else if (strokeWidth <= 30)
  {
    canvas.freeDrawingCursor = 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAMAAAAM7l6QAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAABaUExURQAAAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP///8qDcwwAAAAddFJOUwAADSdCVWBlDjRkZ2YDVigHOmM7QVcPQ2E1KQhEf2xkFgAAAAFiS0dEHesDcZEAAAAHdElNRQfnBgYGLwPiJj6DAAAA2klEQVQoz4WT6w6DIAyFi4iAxTJ1XnZ5/+dcxehmAt35BfmaBtpzADYpVqVr01jbmFpX2x1O8cV50yIGFmJrvPtyPnWadrYLkWJ3FCh164cfmAqG8bZjpveQ0T1x7tyHrEbuz1gPeTzEDTvCPMZpZuwLlLlXUJkypgp0G4pqI9RYxriAkTBBEwStYCVs/+E/zUl+2iJ/LMpjEYfqxJU8toVO4kJVLNnhmdzSjXmczFS0Yv06rTpmjPxSB1ZdnK4xmJ5nDFLCZk/fENFjvqQsRTC+abV2pSW6E34Ax98krJ/H0HkAAAAldEVYdGRhdGU6Y3JlYXRlADIwMjMtMDYtMDZUMDY6NDY6NTgrMDA6MDCdhDVeAAAAJXRFWHRkYXRlOm1vZGlmeQAyMDIzLTA2LTA2VDA2OjQ2OjU4KzAwOjAw7NmN4gAAACh0RVh0ZGF0ZTp0aW1lc3RhbXAAMjAyMy0wNi0wNlQwNjo0NzowMyswMDowMB7pnZ0AAAAASUVORK5CYII=) 15 15, auto';
  }
  else if (strokeWidth <= 40)
  {
    canvas.freeDrawingCursor = 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAMAAAC7IEhfAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAACTUExURQAAAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP///5tDgIwAAAAwdFJOUwAACyA4TFliZQEUNlNhZmcRO10DKFdYKQhjCkRFPBU3VAwhOk1bORY9AhIJRl4iTsN0L8IAAAABYktHRDCu3C3kAAAAB3RJTUUH5wYGBi41NIeaWwAAAU5JREFUOMuN1dmSgjAQBdAEgbCZGFCWkbAIjNss//9306CWMgLpfrA0dcqOmL4h5F60L2NlWjZzHGZb5soYlsi/giXX84M1F4JDwSsLfM99k7CwkeENPUqIUG7GEj5F292Y3WicRC8U3qYye2MDzWT6lJR+7Pls5cYDwvftxTwUeXqTsD/JF0tGvYQdbLNlmCX9NuG57MQyFPGmh67UOJDKBeiFehgWAH2tA1lSYgQYWNVktdY7ztmBmBjHeUMsRGfo3RIbBXlHGK41Iw4OOniIbo3+MS328XziWjfkgNok/IXoQ0FLDDThPBaYg3vsR0Hp4ek8DFesGy77MkwhTVDjiggAFT2iIs0XI+X6DB8jn4dfxkua0auaiz11HQdklMRTQWqPgvQezeotmr9Pl6kQd4uyYvxuIewr83ievhYorX+atuuvj+63OdSj6+MPTEROdLxSatUAAAAldEVYdGRhdGU6Y3JlYXRlADIwMjMtMDYtMDZUMDY6NDY6MjIrMDA6MDAzMWMJAAAAJXRFWHRkYXRlOm1vZGlmeQAyMDIzLTA2LTA2VDA2OjQ2OjIyKzAwOjAwQmzbtQAAACh0RVh0ZGF0ZTp0aW1lc3RhbXAAMjAyMy0wNi0wNlQwNjo0Njo1MyswMDowMLnL+McAAAAASUVORK5CYII=) 20 20, auto';
  }
  else if (strokeWidth <= 50)
  {
    canvas.freeDrawingCursor = 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAMAAAAp4XiDAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAC9UExURQAAAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP///zBnhJ8AAAA+dFJOUwAACBkvQlFcYmYDFTNPXmVnXzQWG0McEj9gEyhYKQQJO2M8DUZHSipZQBc1UBoxRFNdYR1BFD1ICg5LHjYYo3WIDQAAAAFiS0dEPklkAOMAAAAHdElNRQfnBgYGLw/rkHKoAAABq0lEQVRIx53WaXuCMAwA4Na73YTiNUEHouKtqPNix///W0tBfTxAGvIN7Ps0YElCyG1QiFy+UCyVK4xVyqViIZ+T90hCyN/423tV04VgYQihG9VanSeoEDSa2mX5JYTQmq14BPc+2uYjiJDZtp6J3KLTjVl/Vt1P+wHBpdNzEwUYt+/cGbgYDFlKeINbA2Ik0ogYDa5EZjVMFWC8a27w5L10IKNvRwRkx1Uj7jjaBv6PrkJaYWoTKyK8rSjATDmVm7RMVcGY2YJtKG8qbwLbNGEbWtcwRJsBqSEEmDkluSqOLByS1zCCMWNJCjqO6CtSROUFmfmkhCVrUsYJxjakgiUuwQrGspAMiWV4/AwvGXP0Q+JnOTBLA0fgWGY4/HSO/sSQH7IxQ5cLX5YLVFHafsnaR/lUvfTteEioNVEusPtzTaZjZBkHY/fVyMG+9hfqeCot6XiiN30sUGh838Fdr6SBl0aOwWNLPvVfN/HD6bnx2+Pkdy0mYzt2vrB2CQPJdrdPmGEob8WNPYb/83JWms0Xxt1wtfj942kjmdNY+esNnAd3s/ZXS+dp/T/3/1y1D0WWdgAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAyMy0wNi0wNlQwNjo0NzoxMCswMDowMMXjHv0AAAAldEVYdGRhdGU6bW9kaWZ5ADIwMjMtMDYtMDZUMDY6NDc6MTArMDA6MDC0vqZBAAAAKHRFWHRkYXRlOnRpbWVzdGFtcAAyMDIzLTA2LTA2VDA2OjQ3OjE1KzAwOjAwsZOoOQAAAABJRU5ErkJggg==) 25 25, auto';
  }
  else if (strokeWidth <= 60)
  {
    canvas.freeDrawingCursor = 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAMAAAANIilAAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAADAUExURQAAAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP///wYMEYoAAAA/dFJOUwAABRMmOUhUXWNmBgMUL0lbYmcwFQQhREUHIEpLQWFCKFhZKgo7PA9HEBFNQyJGFjI6Vl5cMSRMIz0LTk8SCOc6ipgAAAABYktHRD8+YzB1AAAAB3RJTUUH5wYGBi8ZH0TH+QAAAiJJREFUSMell+uamjAQhhNRJGFZDCW6LKylnupxUbGt2m3v/7I6EbWuooFh/vgQfPkmgWS+IeQ6KETNqDfMpsU4Z1bTbNQNW40SXcB/npxntyW45/FDwK9ouV98qcHV4+12xzqDp4Br66UdPJBXt+RrKK7JEy+itryHq3HjrZtLHvnuVyefVrLxtwfoAe/186YOQ4Oh0LBAi9HghoaB72MdmYU5uaLhcjrTyh7FZ9NPtNItyir6UlvNd1yYBdq8mDes87A4qmIkTzA8JRblYNY/ScO3oXu/N4n3/BMs30qyQM+zxCl97ZZlOReLDA7C0sIgHQVUCbdLrtaFNH3qIIRB+l0C7Fg42EoAfsagKpaU1FyUMEiHNjFaWLhlkDpqrVWwmDSwLOcrYiKzVpMmTTTM18TCp50ShocZwbOcV4MrpV1pwSq9qkofyQqf9qraxsBvyY1DbMzZmU3ZJvQHNm04hqiPOwB5qg5A+YI7Pcfq6KUL1Hqzn6re0CDClJtfQVboMNJim9VYKuflS2yndoSp3ytd3JOzM6D9krv6v61QhmZUDt7JCzdEB2V2pufuPxuxye/iJu5jcm0B/xSlvQ/j1nxOzGKwO82zvfsd01tmttvnG27Z173vO2Y9axP8+SO/7olO8qjJkIvoToMCGc+2NU1/Eyzec1ujdLz9q+vMlHqyDDeMn3mPs024TGSRpu4g78ercJ2qdjBdR8PYyW8H/wHd3ojgP16WdQAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAyMy0wNi0wNlQwNjo0NzoyMSswMDowMO0bEqoAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMjMtMDYtMDZUMDY6NDc6MjErMDA6MDCcRqoWAAAAKHRFWHRkYXRlOnRpbWVzdGFtcAAyMDIzLTA2LTA2VDA2OjQ3OjI1KzAwOjAwPxyv2gAAAABJRU5ErkJggg==) 30 30, auto';
  }
  else if (strokeWidth <= 70)
  {
    canvas.freeDrawingCursor = 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEYAAABGCAMAAABG8BK2AAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAADtUExURQAAAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP///wcxMuAAAABOdFJOUwAAAw0eLz5LV15jZgISKUJWZWcqCSJDWkQjCk8rBSVkBhViFgQoWFk6PBBIEVBRRScLJFsUDl8hMUBOPzAfEywMJkYHGD1KUlMXSS0PQeNnZUUAAAABYktHRE4ZYXHfAAAAB3RJTUUH5wYGBi8j2UgeSwAAApJJREFUWMOtmHl72jAMxu1wJXFTSNKOlBychTJKgAGBsqOMlq7ttu//dSYTGEcTctj6E+f58Uq2ZUkIBRimJmSyuXxBlGRCZEks5HPZjLBZQDENPr1QLoslSdU0sjVNU6VSUVeEmBz6f1fXn8qA+M/YkTS1bNxcxVBEP6nopnyK2KNk06pEgOiy7ZjVEMaWVDWd2jkQXasXG2chG1DDaIZzYKF1246EbEAdvRXCoVG5i5ayE9StBHLgx889EpNCrXcfwKFhMRNAQFC//oFDKW4iCnDcUw71KJkWX8+xXzS6vcQU4PSO4gw7fZccQq1r7zFAvI270yfW0PdyILzxTl2AW53mDgP3qJiSApxBbcvB2GmkpUBKG+4wleR7fSCnP8K+GKuankJI1aJyINexiAE5JhwewFzLLBSQ84ViLgwmMSDHEACjlFkx4wlgLlU2CpiFkZD+6B14hTIldkxpirISO8aboRx7aIg6R3lmMSDnARV4YBZIZKcQ0kYSD4yHGC+UbzLiQSGEF4aTU5xCzGnDOR2/r3wuwzc+V/M7n0TBI22JUySwPgx+EsU6e2wgpeMfYy4PDLNX2oA+d/iG9fF1Nm84ayngjvySgq0wUR/9OomxTHKXWwz+yaVow7VB+hJy9bQvRZud1AXt80FdjPWUbjUsfFim2910mLV91DOkbD1elqctzH0/RSOkfGyo6r+StmWvb4HtXTI9mvsW3Gwq70kwL0pY67tcx2+g18vwRty24p1DrWPZ58YCuDmQo4cL8uo5akhRG/YjRh2qO3yKMTMZWQAKHbxU3d/LuBMcxxiToDEQGa+cqOnNIUmYWIboHQ+lPNGwJq2YjJ0i3Pozmz8s2h4dkXntxd/5bBo+IvsHl37Lf0hsfB8AAAAldEVYdGRhdGU6Y3JlYXRlADIwMjMtMDYtMDZUMDY6NDc6MzErMDA6MDAhsRI0AAAAJXRFWHRkYXRlOm1vZGlmeQAyMDIzLTA2LTA2VDA2OjQ3OjMxKzAwOjAwUOyqiAAAACh0RVh0ZGF0ZTp0aW1lc3RhbXAAMjAyMy0wNi0wNlQwNjo0NzozNSswMDowMPO2r0QAAAAASUVORK5CYII=) 35 35, auto';
  }
  else if (strokeWidth <= 80)
  {
    canvas.freeDrawingCursor = 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAMAAAC5zwKfAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAECUExURQAAAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP/uAP///+TQf2EAAABVdFJOUwAACRglNEJPWF9kZgMPIz1ZYyQECCE/Z2gKLlBhYhANMVVlMgYoUVIBFkNFFykqCzsMEkgTGVQFKwdTDjMwQVoRJj5bGic2RmA1QC9WRyxLFBtKVzgaHFLZAAAAAWJLR0RVkwS4MwAAAAd0SU1FB+cGBgYvLqf5YvYAAAMRSURBVFjDrZlpQ+IwEIYTytmIpcAStZRTShW0umhBWS0oXrtee/z/37KTggoCtcfMx6Q8vG2umTeErAsqIibFE8lUOiMzJmfSqWQiLsXcDkoChfuTjeymksqpbCHUXErJZwsBmeLp4rdSWuZbnH0KaJLTpfx2AKJ4NLujlfkS7B3KdW2n4hMpHqvW6o31uCmzUW9W/SDhkd2W0fCmzZDt1u5XROg39/Z1HzgXqXa6pjeS0sJB2ifOReYOCx5A+DPrqByAB8SycrxWI3R877FAPBG9kzVEaN7TAuMgDGklERpP7RA4CPt0FRH02WH0iQ9pS0tA8f20cDj3rZe+I4xvL6Q+N3rHi0CYf0cRcBBKf54I6+Mg2PxbCn1gzhFhQIKsj1XBc90PIOwH+xF5QOycvRMpbelRebCXH74BYf8zIgsEiefDKRFmUK0RncdY48d0XCit1BEEgsR6ZQbcQREIEi+mwFioPWaVxDachSBws4zDY6ycF8CNEpJAkHhZAGA26iKZC2cEwE0ZjcfkMQAVPIGMX1ESS23hAbe0bSLlMBVeT0hcjc75CPWGJDB5jN2SJC7wjqRwgQZJ4wIdksEF3hPEdSJCJrg8xvCB6K+MPijo0wZ9YqMvvQdc4C0ZY29fkoO8waIeAVyzCL3CVFgyCY1jH6MVBw/oHvSFn8ipCM0j5MPT0ONu9rWNl85ZIkGk9BdSwsmayCnx42gGpE2cpD1hvpUBw3OMssIefhQqBwg7hDqYq6TOOtFLs6fifLHXjZrUcUdaqEbNQcTZrT+biwVzX4kGXCzABfG4F+WFX6pLngM9CV+ScuOVrvBFpNA2y+Mq4waaJuGI/PH3OmtJMsLw2qfrza+TP8GBL69e9lxV8etGzuTpStXDkoSu/nOQc5o7z31Pi1NYpt2O6tsyfZJMHy7s2aHtz9S1B0V/NjEdNutfITn7+zAM4GRXLtpeo8P1dm305dsuIq38pSPzZXscmmQnObaCXwbQwmhc0q4/Xy5ca6XxqB/2wsK0Jje3d4ZzL64/7h3j7l9rYpmetP+1ZQxwgWtB0AAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAyMy0wNi0wNlQwNjo0Nzo0MiswMDowMBqcAbAAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMjMtMDYtMDZUMDY6NDc6NDIrMDA6MDBrwbkMAAAAKHRFWHRkYXRlOnRpbWVzdGFtcAAyMDIzLTA2LTA2VDA2OjQ3OjQ2KzAwOjAwyJu8wAAAAABJRU5ErkJggg==) 40 40, auto';
  }
  else if (strokeWidth <= 90)
  {
    canvas.freeDrawingCursor = 'url(data:image/png;base64,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) 45 45, auto';
  }
  else if (strokeWidth <= 100)
  {
    canvas.freeDrawingCursor = 'url(data:image/png;base64,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) 50 50, auto';
  }

  const [backgroundCanvas, setBackgroundCanvas] = useState(
    new fabric.StaticCanvas("")
  )
  const {
    canvasState: {
      action: { shouldReloadCanvas, forceSendToStreamlit },
      currentState,
      initialState,
    },
    saveState,
    undo,
    redo,
    canUndo,
    canRedo,
    forceStreamlitUpdate,
    resetState,
  } = useCanvasState()

  /**
   * Initialize canvases on component mount
   * NB: Remount component by changing its key instead of defining deps
   */
  useEffect(() => {
    const c = new fabric.Canvas("canvas", {
      enableRetinaScaling: false,
    })
    const imgC = new fabric.StaticCanvas("backgroundimage-canvas", {
      enableRetinaScaling: false,
    })
    setCanvas(c)
    setBackgroundCanvas(imgC)
    Streamlit.setFrameHeight()
  }, [])

  /**
   * Load user drawing into canvas
   * Python-side is in charge of initializing drawing with background color if none provided
   */
  useEffect(() => {
    if (!isEqual(initialState, initialDrawing)) {
      canvas.loadFromJSON(initialDrawing, () => {
        canvas.renderAll()
        resetState(initialDrawing)
      })
    }
  }, [canvas, initialDrawing, initialState, resetState])

  /**
   * Update background image
   */
  useEffect(() => {
    if (backgroundImageURL) {
      var bgImage = new Image();
      bgImage.onload = function() {
        backgroundCanvas.getContext().drawImage(bgImage, 0, 0);
      };
      const params = new URLSearchParams(window.location.search);
      const baseUrl = params.get('streamlitUrl')
      bgImage.src = baseUrl + backgroundImageURL;
    }
  }, [
    canvas,
    backgroundCanvas,
    canvasHeight,
    canvasWidth,
    backgroundColor,
    backgroundImageURL,
    saveState,
  ])

  /**
   * If state changed from undo/redo/reset, update user-facing canvas
   */
  useEffect(() => {
    if (shouldReloadCanvas) {
      canvas.loadFromJSON(currentState, () => {})
    }
  }, [canvas, shouldReloadCanvas, currentState])

  /**
   * Update canvas with selected tool
   * PS: add initialDrawing in dependency so user drawing update reinits tool
   */
  useEffect(() => {
    // Update canvas events with selected tool
    const selectedTool = new tools[drawingMode](canvas) as FabricTool
    const cleanupToolEvents = selectedTool.configureCanvas({
      fillColor: fillColor,
      strokeWidth: strokeWidth,
      strokeColor: strokeColor,
      displayRadius: displayRadius
    })

    canvas.on("mouse:up", (e: any) => {
      saveState(canvas.toJSON())
      if (e["button"] === 3) {
        forceStreamlitUpdate()
      }
    })

    canvas.on("mouse:dblclick", () => {
      saveState(canvas.toJSON())
    })

    // Cleanup tool + send data to Streamlit events
    return () => {
      cleanupToolEvents()
      canvas.off("mouse:up")
      canvas.off("mouse:dblclick")
    }
  }, [
    canvas,
    strokeWidth,
    strokeColor,
    displayRadius,
    fillColor,
    drawingMode,
    initialDrawing,
    saveState,
    forceStreamlitUpdate,
  ])

  /**
   * Render canvas w/ toolbar
   */
  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: -10,
          visibility: "hidden",
        }}
      >
        <UpdateStreamlit
          canvasHeight={canvasHeight}
          canvasWidth={canvasWidth}
          shouldSendToStreamlit={
            realtimeUpdateStreamlit || forceSendToStreamlit
          }
          stateToSendToStreamlit={currentState}
        />
      </div>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 0,
        }}
      >
        <canvas
          id="backgroundimage-canvas"
          width={canvasWidth}
          height={canvasHeight}
        />
      </div>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 10,
        }}
      >
        <canvas
          id="canvas"
          width={canvasWidth}
          height={canvasHeight}
          style={{ border: "lightgrey 1px solid" }}
        />
      </div>
      {displayToolbar && (
        <CanvasToolbar
          topPosition={canvasHeight}
          leftPosition={canvasWidth}
          canUndo={canUndo}
          canRedo={canRedo}
          downloadCallback={forceStreamlitUpdate}
          undoCallback={undo}
          redoCallback={redo}
          resetCallback={() => {
            resetState(initialState)
          }}
        />
      )}
    </div>
  )
}

export default withStreamlitConnection(DrawableCanvas)
