import urllib2
from bs4 import BeautifulSoup, NavigableString, Tag
import csv
import json
import time
import sys

'''
Data is organized for export in two ways:
  1. By location. For showing an overview map.
  2. By sport. To make filtering the map by sport easier.
'''
# should look like [{'name': 'city, state', 'lat': 43, 'lng': -89, 'members': [{'name': 'Athlete', 'sport': 'Skiing'}]}]
locations = []
unknownLocations = []

# should look like [{'name', 'Snowboarding', 'locations': [{'name': 'Aspen', 'lat': 40, 'lng': -111, 'members': [{'name': 'Athlete'}]}]}]
sports = []

page = 1
url = 'http://www.teamusa.org/Athletes?season={79EDD928-E32F-4D4A-99DC-C3BE91F718DF}&page='

# Helper function for getting the index of a dictionary in a list by value
# via http://stackoverflow.com/questions/4391697/find-the-index-of-a-dict-within-a-list-by-matching-the-dicts-value
def get_index(seq, value):
    return next(index for (index, d) in enumerate(seq) if d['name'] == value)

# Loop through all pages
while page <= 83:
    result = urllib2.urlopen(url + str(page))
    soup = BeautifulSoup(result)

    # The list of athletes on a given page is in a <ul> with the class 'thumb-row athletes'
    content = soup.findChild(class_='thumb-row athletes')

    # Each <li> contains the info about an athlete
    for each in content.find_all('li'):
        athlete = {}

        # Get name
        try:
            name = ''.join(each.findChild('h4').string)
            name = name.replace('\n', '').replace('\r', '').strip().encode('utf8')
            athlete['name'] = name
        except AttributeError:
            continue

        # Get link to profile
        try:
            link = ''.join(each.findChild('a').get('href'))
            athlete['link'] = link
        except AttributeError:
            continue

        # Get picture URL
        try:
            picture = ''.join(each.findChild('img').get('src'))
            athlete['picture'] = picture
        except AttributeError:
            continue
        
        # Get location and sport
        try:
            sport = each.findChild('h5').findChild(class_='sport').get_text()
            sport = sport.replace('\n', '').replace('\r', '').replace('USA ', '').replace('US ', '').strip().encode('utf8')
            athlete['sport'] = sport

            info = ''.join(each.findChild('h5').find(text=True)) 
            info = info.encode('utf8').split('|')

            location = info[0].replace('\n', '').replace('\r', '').strip().encode('utf8')

            #Clean up. For some reason many locations have a dublicate like 'City , State', when it should be 'City, State'
            parts = location.split(',')
            parts[0] = parts[0].rstrip()
            location = ','.join(parts)

        except AttributeError:
            continue

        # Add to locations list. First, check if we have already recorded this location
        try:
            # If the location is reasonably precise (i.e. City, State)
            if "," in location:
                index = get_index(locations, location)
                # If so, add the athlete to that location
                locations[index]['members'].append(athlete)

            # If the location is coarse (i.e. City)
            else:
                index = get_index(unknownLocations, location)
                # If so, add the athlete to that location
                unknownLocations[index]['members'].append(athlete)

        # If we haven't recoreded this location, add it to the locations list
        except StopIteration:
            if location != '':
                if "," in location:
                    newLocation = {'name': location, 'members': [athlete]}

                    # Make sure we don't hit our geocoding rate limit
                    time.sleep(1)

                    # Geocode it. Unfortunately Google seems to do the best job...
                    req = urllib2.urlopen('http://maps.googleapis.com/maps/api/geocode/json?address=' + location.replace(' ', '%20') + '&sensor=false')
                    address = json.load(req)
                    newLocation['lat'] = address['results'][0]['geometry']['location']['lat']
                    newLocation['lng'] = address['results'][0]['geometry']['location']['lng']

                    # Add geocoded location to locations list
                    locations.append(newLocation)
                else:
                    newLocation = {'name': location, 'members': [athlete]}
                    newLocation['members'][0]['sport'] = sport
                    # We're not going to geocode it right now. We'll try later.
                    unknownLocations.append(newLocation)

    print "Finished page: ", page
    page += 1

# Try and match coarse locations to fine ones
# For example, if we have 'Salt Lake City, Utah', match all instances of 'Salt Lake City' to it.
for unknownLoc in unknownLocations:
    for loc in locations:
        tempLoc = loc['name'].split(',')
        if unknownLoc['name'] == tempLoc[0]:
            for athlete in unknownLoc['members']:
                loc['members'].append(athlete)

# Build the sports list
# Add to sports list. First, check if we have already recorded this sport
for location in locations:
    for athlete in location['members']:
        try:
            index = get_index(sports, athlete['sport'])

            # If so, check if we have this location for this sport
            try:
                loc_index = get_index(sports[index]['locations'], location['name'])

                # If we do, add the athlete
                sports[index]['locations'][loc_index]['members'].append(athlete)

            # If we don't have this location for this sport
            except StopIteration:
                # Get the location info
                locations_index = get_index(locations, location['name'])
                new_location = {'name': location['name'], 'lat': locations[locations_index]['lat'], 'lng': locations[locations_index]['lng'], 'members': [athlete]}

                # Add this new location to the existing sport
                sports[index]['locations'].append(new_location)

        # If we don't have this sport
        except StopIteration:
            # Get the location info
            locations_index = get_index(locations, location['name'])

            new_sport = {'name': athlete['sport'], 'locations': [{'name': location['name'], 'lat': locations[locations_index]['lat'], 'lng': locations[locations_index]['lng'], 'members': [athlete]}]}

            # Add the new sport + location to the sports list
            sports.append(new_sport)

# Write everything out
with open('data/sports.json', 'w') as sports_file:
  json.dump(sports, sports_file)

with open('data/locations.json', 'w') as locations_file:
  json.dump(locations, locations_file)

print "Done!"