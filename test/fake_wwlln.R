## Replicate WWLLN file generation to perform local end to end tests of the
# data and map pipelines

if (!require(lubridate)) {
    install.packages("lubridate")
}

#' Generate Set of New Strokes
#' 
#' Produce a dataframe with typical WWLLN information
#' 
#' @export
#' @param n Number strokes
#' @param timeRange The span on time from now in which to generate fake data
newStrokes <- function(n = 1000, timeRange = 60) {

    ## Replicate chimneys
    lat <- rnorm(n, 0, 35)
    lon <- c(rnorm(floor(n/2), 10, 25),
             rnorm(floor(n/4), -80, 15),
             rnorm(floor(n/4), 120, 20))
    
    ## Cap latitude and wrap longitude (as needed)
    lat[lat < -89.99] <- -89.99
    lat[lat > 89.99] <- 89.99
    lon <- ((lon + 180) %% 360) - 180
    
    currentTime <- as.numeric(now())
    times <- sample(seq(currentTime - timeRange, currentTime), n, replace = TRUE)
    times <- as.POSIXct(times, origin = "1970-01-01", tz = "UTC")

    nstations <- sample(seq(5, 12), n, replace = TRUE)
    uncertainty <- runif(n, 0, 30)
    
    strokes <- data.frame(
        datetime = times,
        lat = lat,
        lon = lon,
        uncertainty = uncertainty,
        nstations = nstations)
    
    return(strokes)
    
}

#' Convert Stroke Dataframe To Text
#' 
#' Generate WWLLN formatted text from an R dataframe of stroke data
#' 
#' @export
#' @param strokes Dataframe of strokes from \code{\link{newStrokes}} 
strokeText <- function(strokes) {
    
    strokes$year <- year(strokes$date)
    strokes$month <- month(strokes$date)
    strokes$day <- day(strokes$date)
    strokes$hour <- hour(strokes$date)
    strokes$minute <- minute(strokes$date)
    strokes$second <- second(strokes$date)

    
    makeLine <- function(stroke) {
         
        sprintf("%04g/%02g/%02g %02g:%02g:%f, %f, %f, %f, %g",
                stroke$year, stroke$month, stroke$day, stroke$hour,
                stroke$minute, stroke$second, 
                stroke$lat, stroke$lon,
                stroke$uncertainty, stroke$nstations)
        
    }
    
    text <- do.call('c', lapply(seq(1, nrow(strokes)), function(i){
        makeLine(strokes[i, ])
    }))
    
    return(text)
    
}

#' Generate WWLLN Data Every Minute
#' 
#' Create fake A files every minute in the specified directory for use in
#' testing end to end map solutions
#' 
#' @export
#' @param dataDir Directory to write files, default is data
generateWWLLN <- function(dataDir = "data/") {

    dir.create(dataDir, recursive = TRUE, showWarnings = FALSE)
    
    oldTime <- floor_date(now(tzone = "UTC"), unit = "minute")

    while (TRUE) {
        
        text <- strokeText(newStrokes(n = 600, timeRange = 60))
        
        currentTime <- floor_date(now(tzone = "UTC"), unit = "minute")
        
        if (currentTime == oldTime) {
            Sys.sleep(1)
            next()
        }
        
        aName <- sprintf("%sA%04g%02g%02g%02g%02g00.loc", dataDir,
                         year(currentTime), month(currentTime), day(currentTime),
                         hour(currentTime), minute(currentTime))
        
        writeLines(text, aName)
        
        oldTime <- currentTime
        
    }

}

