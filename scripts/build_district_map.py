"""
Makes a small GeoJSON of the 13 Andhra Pradesh districts for the map in the web report.

Boundaries: Census 2011 district shapefile from DataMeet India
(https://github.com/datameet/maps, CC BY 4.0). In 2011 the state still included Telangana,
so I keep only the 13 districts that are in today's AP (the same 13 as the crop data, which
stops in 2014). The shapes are simplified so the file stays small.

Needs: pip install pyshp shapely
"""
import json
import os
import urllib.request

import shapefile
from shapely.geometry import shape, mapping

BASE = os.path.join(os.path.dirname(__file__), "..")
RAW = os.path.join(BASE, "data", "raw", "districts_2011")
OUT = os.path.join(BASE, "docs", "data", "ap_districts.geojson")
URL = "https://raw.githubusercontent.com/datameet/maps/master/Districts/Census_2011/2011_Dist."

# census district code -> name used in the crop data
AP_DISTRICTS = {
    11: "Srikakulam", 12: "Vizianagaram", 13: "Visakhapatanam", 14: "East Godavari",
    15: "West Godavari", 16: "Krishna", 17: "Guntur", 18: "Prakasam", 19: "Spsr Nellore",
    20: "Kadapa", 21: "Kurnool", 22: "Anantapur", 23: "Chittoor",
}


def download():
    os.makedirs(RAW, exist_ok=True)
    for ext in ["shp", "shx", "dbf", "prj"]:
        path = os.path.join(RAW, "2011_Dist." + ext)
        if not os.path.exists(path):
            print("downloading", ext)
            urllib.request.urlretrieve(URL + ext, path)


def main():
    download()
    reader = shapefile.Reader(os.path.join(RAW, "2011_Dist"))
    features = []
    for sr in reader.shapeRecords():
        rec = sr.record.as_dict()
        if rec["ST_NM"] != "Andhra Pradesh" or rec["DT_CEN_CD"] not in AP_DISTRICTS:
            continue
        geom = shape(sr.shape.__geo_interface__).simplify(0.01, preserve_topology=True)
        # round coordinates to ~100 m, plenty for a small map
        gj = json.loads(json.dumps(mapping(geom)), parse_float=lambda x: round(float(x), 3))
        features.append({"type": "Feature",
                         "properties": {"district": AP_DISTRICTS[rec["DT_CEN_CD"]]},
                         "geometry": gj})
    print("districts:", len(features))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump({"type": "FeatureCollection", "features": features}, f, separators=(",", ":"))
    print("saved", OUT, os.path.getsize(OUT) // 1024, "KB")


if __name__ == "__main__":
    main()
