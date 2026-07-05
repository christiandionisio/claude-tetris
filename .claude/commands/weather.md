Fetch and display current local weather.

## Steps

1. If `$ARGUMENTS` is provided, use it as the location. Otherwise, default to **Lima, Peru**.
   Skip IP geolocation entirely.

2. Fetch weather for that city using wttr.in (no API key needed):
   ```
   curl -s "https://wttr.in/{CITY}?format=j1"
   ```
   Replace `{CITY}` with the city from step 1.

3. Parse and display:
   - Current temperature (°C and °F)
   - Feels like temperature
   - Weather description
   - Humidity %
   - Wind speed and direction
   - Visibility
   - Today's high/low forecast

4. Default location is Lima, Peru. Override with `$ARGUMENTS` if provided.
   Example: `/weather Buenos Aires` → fetch weather for Buenos Aires.

Format output as a clean, readable weather report with emoji icons for conditions.
Show detected/used location at the top so user knows what city was resolved.
