import moment, {unitOfTime} from 'moment'
import {IAugmentedJQuery} from 'angular'
import {GanttCalendar, TimeFrame, TimeFramesDisplayMode} from '../calendar/calendar.factory'

/**
 * Used to display the Gantt grid and header.
 * The columns are generated by the column generator.
 */
export class GanttColumn {
  date: moment.Moment
  endDate: moment.Moment
  left: number
  width: number
  duration: number
  originalSize: { left: number; width: number }
  $element: IAugmentedJQuery
  calendar: GanttCalendar
  timeFramesWorkingMode: TimeFramesDisplayMode
  timeFramesNonWorkingMode: TimeFramesDisplayMode

  timeFrames: TimeFrame[] = []
  visibleTimeFrames: TimeFrame[] = []
  daysTimeFrames: { [dateKey: string]: TimeFrame[] } = {}

  currentDate = false
  cropped = false

  constructor (date: moment.Moment,
              endDate: moment.Moment,
              left: number,
              width: number,
              calendar?: GanttCalendar,
              timeFramesWorkingMode?: TimeFramesDisplayMode,
              timeFramesNonWorkingMode?: TimeFramesDisplayMode) {
    this.date = date
    this.endDate = endDate
    this.left = left
    this.width = width
    this.calendar = calendar
    this.duration = this.endDate.diff(this.date, 'milliseconds')
    this.timeFramesWorkingMode = timeFramesWorkingMode
    this.timeFramesNonWorkingMode = timeFramesNonWorkingMode
    this.timeFrames = []
    this.visibleTimeFrames = []
    this.daysTimeFrames = {}
    this.originalSize = {left: this.left, width: this.width}
    this.updateTimeFrames()
  }

  private getDateKey (date: moment.Moment) {
    return date.year() + '-' + date.month() + '-' + date.date()
  }

  updateView () {
    if (this.$element) {
      if (this.currentDate) {
        this.$element.addClass('gantt-foreground-col-current-date')
      } else {
        this.$element.removeClass('gantt-foreground-col-current-date')
      }

      this.$element.css({'left': this.left + 'px', 'width': this.width + 'px'})
      this.timeFrames.forEach((timeFrame) => timeFrame.updateView())
    }
  }

  updateTimeFrames () {
    if (this.calendar !== undefined && (this.timeFramesNonWorkingMode !== 'hidden' || this.timeFramesWorkingMode !== 'hidden')) {
      let cDate = this.date
      let cDateStartOfDay = moment(cDate).startOf('day')
      let cDateNextDay = cDateStartOfDay.add(1, 'day')
      let i
      while (cDate < this.endDate) {
        let timeFrames = this.calendar.getTimeFrames(cDate)
        let nextCDate = moment.min(cDateNextDay, this.endDate)
        timeFrames = this.calendar.solve(timeFrames, cDate, nextCDate)
        let cTimeFrames = []
        for (i = 0; i < timeFrames.length; i++) {
          let cTimeFrame = timeFrames[i]

          let start = cTimeFrame.start
          if (start === undefined) {
            start = cDate
          }

          let end = cTimeFrame.end
          if (end === undefined) {
            end = nextCDate
          }

          if (start < this.date) {
            start = this.date
          }

          if (end > this.endDate) {
            end = this.endDate
          }

          cTimeFrame = cTimeFrame.clone()

          cTimeFrame.start = moment(start)
          cTimeFrame.end = moment(end)

          cTimeFrames.push(cTimeFrame)
        }
        this.timeFrames = this.timeFrames.concat(cTimeFrames)

        let cDateKey = this.getDateKey(cDate)
        this.daysTimeFrames[cDateKey] = cTimeFrames

        cDate = nextCDate
        cDateStartOfDay = moment(cDate).startOf('day')
        cDateNextDay = cDateStartOfDay.add(1, 'day')
      }

      for (i = 0; i < this.timeFrames.length; i++) {
        let timeFrame = this.timeFrames[i]

        let positionDuration = timeFrame.start.diff(this.date, 'milliseconds')
        let position = positionDuration / this.duration * this.width

        let timeFrameDuration = timeFrame.end.diff(timeFrame.start, 'milliseconds')
        let timeFramePosition = timeFrameDuration / this.duration * this.width

        let hidden = false
        if (timeFrame.working && this.timeFramesWorkingMode !== 'visible') {
          hidden = true
        } else if (!timeFrame.working && this.timeFramesNonWorkingMode !== 'visible') {
          hidden = true
        }

        if (!hidden) {
          this.visibleTimeFrames.push(timeFrame)
        }

        timeFrame.hidden = hidden
        timeFrame.left = position
        timeFrame.width = timeFramePosition
        timeFrame.originalSize = {left: timeFrame.left, width: timeFrame.width}
      }

      if (this.timeFramesNonWorkingMode === 'cropped' || this.timeFramesWorkingMode === 'cropped') {
        let timeFramesWidth = 0
        for (let aTimeFrame of this.timeFrames) {
          if (!aTimeFrame.working && this.timeFramesNonWorkingMode !== 'cropped' ||
            aTimeFrame.working && this.timeFramesWorkingMode !== 'cropped') {
            timeFramesWidth += aTimeFrame.width
          }
        }

        if (timeFramesWidth !== this.width) {
          let croppedRatio = this.width / timeFramesWidth
          let croppedWidth = 0
          let originalCroppedWidth = 0

          let allCropped = true

          for (let bTimeFrame of this.timeFrames) {
            if (!bTimeFrame.working && this.timeFramesNonWorkingMode !== 'cropped' ||
              bTimeFrame.working && this.timeFramesWorkingMode !== 'cropped') {
              bTimeFrame.left = (bTimeFrame.left - croppedWidth) * croppedRatio
              bTimeFrame.width = bTimeFrame.width * croppedRatio
              bTimeFrame.originalSize.left = (bTimeFrame.originalSize.left - originalCroppedWidth) * croppedRatio
              bTimeFrame.originalSize.width = bTimeFrame.originalSize.width * croppedRatio
              bTimeFrame.cropped = false
              allCropped = false
            } else {
              croppedWidth += bTimeFrame.width
              originalCroppedWidth += bTimeFrame.originalSize.width
              bTimeFrame.left = undefined
              bTimeFrame.width = 0
              bTimeFrame.originalSize = {left: undefined, width: 0}
              bTimeFrame.cropped = true
            }
          }

          this.cropped = allCropped
        } else {
          this.cropped = false
        }
      }
    }
  }

  clone () {
    return new GanttColumn(moment(this.date), moment(this.endDate), this.left, this.width, this.calendar)
  }

  containsDate (date: moment.Moment) {
    return date > this.date && date <= this.endDate
  }

  equals (other: GanttColumn) {
    return this.date === other.date
  }

  roundTo (date: moment.Moment, unit: unitOfTime.All, offset: number, midpoint?: 'up' | 'down') {
    // Waiting merge of https://github.com/moment/moment/pull/1794
    if (unit === 'day') {
      // Inconsistency in units in momentJS.
      unit = 'date'
    }

    offset = offset || 1
    let value = date.get(unit)

    switch (midpoint) {
      case 'up':
        value = Math.ceil(value / offset)
        break
      case 'down':
        value = Math.floor(value / offset)
        break
      default:
        value = Math.round(value / offset)
        break
    }

    let units = ['millisecond', 'second', 'minute', 'hour', 'date', 'month', 'year'] as unitOfTime.All[]
    date.set(unit, value * offset)

    let indexOf = units.indexOf(unit)
    for (let i = 0; i < indexOf; i++) {
      date.set(units[i], 0)
    }

    return date
  }

  getMagnetDate (date: moment.Moment, magnetValue?: number, magnetUnit?: unitOfTime.All, timeFramesMagnet?: boolean) {
    if (magnetValue > 0 && magnetUnit !== undefined) {
      let initialDate = date
      date = moment(date)

      if (magnetUnit as string === 'column') {
        // Snap to column borders only.
        let position = this.getPositionByDate(date)

        if (position < this.width / 2) {
          date = moment(this.date)
        } else {
          date = moment(this.endDate)
        }
      } else {
        // Round the value
        date = this.roundTo(date, magnetUnit, magnetValue)

        // Snap to column borders if date overflows.
        if (date < this.date) {
          date = moment(this.date)
        } else if (date > this.endDate) {
          date = moment(this.endDate)
        }
      }

      if (timeFramesMagnet) {
        let maxTimeFrameDiff = Math.abs(initialDate.diff(date, 'milliseconds'))
        let currentTimeFrameDiff

        for (let i = 0; i < this.timeFrames.length; i++) {
          let timeFrame = this.timeFrames[i]
          if (timeFrame.magnet) {
            let previousTimeFrame = this.timeFrames[i - 1]
            let nextTimeFrame = this.timeFrames[i + 1]
            let timeFrameDiff

            if (previousTimeFrame === undefined || previousTimeFrame.working !== timeFrame.working) {
              timeFrameDiff = Math.abs(initialDate.diff(timeFrame.start, 'milliseconds'))
              if (timeFrameDiff < maxTimeFrameDiff && (currentTimeFrameDiff === undefined || timeFrameDiff < currentTimeFrameDiff)) {
                currentTimeFrameDiff = timeFrameDiff
                date = timeFrame.start
              }
            }

            if (nextTimeFrame === undefined || nextTimeFrame.working !== timeFrame.working) {
              timeFrameDiff = Math.abs(initialDate.diff(timeFrame.end, 'milliseconds'))
              if (timeFrameDiff < maxTimeFrameDiff && (currentTimeFrameDiff === undefined || timeFrameDiff < currentTimeFrameDiff)) {
                currentTimeFrameDiff = timeFrameDiff
                date = timeFrame.end
              }
            }
          }
        }
      }
    }
    return date
  }

  getDateByPositionUsingTimeFrames (position: number) {
    for (let timeFrame of this.timeFrames) {
      if (!timeFrame.cropped && position >= timeFrame.left && position <= timeFrame.left + timeFrame.width) {
        let positionDuration = timeFrame.getDuration() / timeFrame.width * (position - timeFrame.left)
        let date = moment(timeFrame.start).add(positionDuration, 'milliseconds')
        return date
      }
    }
  }

  getDateByPosition (position: number, magnetValue?: number, magnetUnit?: unitOfTime.All, timeFramesMagnet?: boolean) {
    let date

    if (position < 0) {
      position = 0
    }
    if (position > this.width) {
      position = this.width
    }

    if (this.timeFramesNonWorkingMode === 'cropped' || this.timeFramesWorkingMode === 'cropped') {
      date = this.getDateByPositionUsingTimeFrames(position)
    }

    if (date === undefined) {
      let positionDuration = this.duration / this.width * position
      date = moment(this.date).add(positionDuration, 'milliseconds')
    }

    date = this.getMagnetDate(date, magnetValue, magnetUnit, timeFramesMagnet)

    return date
  }

  getDayTimeFrame (date: moment.Moment) {
    let dtf = this.daysTimeFrames[this.getDateKey(date)]
    if (dtf === undefined) {
      return []
    }
    return dtf
  }

  getPositionByDate (date: moment.Moment) {
    let croppedDate = date

    if (this.timeFramesNonWorkingMode === 'cropped' || this.timeFramesWorkingMode === 'cropped') {
      let timeFrames = this.getDayTimeFrame(croppedDate)
      for (let i = 0; i < timeFrames.length; i++) {
        let timeFrame = timeFrames[i]
        if (croppedDate >= timeFrame.start && croppedDate <= timeFrame.end) {
          if (timeFrame.cropped) {
            if (timeFrames.length > i + 1) {
              croppedDate = timeFrames[i + 1].start
            } else {
              croppedDate = timeFrame.end
            }
          } else {
            let positionDuration = croppedDate.diff(timeFrame.start, 'milliseconds')
            let position = positionDuration / timeFrame.getDuration() * timeFrame.width
            return this.left + timeFrame.left + position
          }
        }
      }
    }

    let positionDuration = croppedDate.diff(this.date, 'milliseconds')
    let position = positionDuration / this.duration * this.width

    if (position < 0) {
      position = 0
    }

    if (position > this.width) {
      position = this.width
    }

    return this.left + position
  }
}

export default function () {
  'ngInject'

  return GanttColumn
}
