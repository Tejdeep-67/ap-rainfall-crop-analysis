"""
Builds docs/data/story.json for the web report (the scrolling data story in docs/).

It repeats the main calculations from notebooks/ap_rainfall_crop_eda.ipynb and saves only
the small tables the charts need, so the page doesn't have to load the raw CSVs.
"""
import json
import os

import numpy as np
import pandas as pd
from scipy import stats

BASE = os.path.join(os.path.dirname(__file__), "..")
RAIN_CSV = os.path.join(BASE, "data", "raw", "Sub_Division_IMD_2017.csv")
CROP_CSV = os.path.join(BASE, "data", "ap_crop_production.csv")
OUT = os.path.join(BASE, "docs", "data", "story.json")

MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
RAYALASEEMA = ["Anantapur", "Chittoor", "Kadapa", "Kurnool"]


def r1(x):
    return None if pd.isna(x) else round(float(x), 1)


def rainfall_part():
    rain = pd.read_csv(RAIN_CSV)
    ap = rain[rain["SUBDIVISION"].isin(["Coastal Andhra Pradesh", "Rayalseema"])].copy()
    ap["SUBDIVISION"] = ap["SUBDIVISION"].replace({"Rayalseema": "Rayalaseema", "Coastal Andhra Pradesh": "Coastal AP"})

    out = {}
    for name, g in ap.groupby("SUBDIVISION"):
        g = g.sort_values("YEAR")
        mean = g["ANNUAL"].mean()
        dep = (g["ANNUAL"] - mean) / mean * 100
        cat = np.where(dep < -20, "Deficient", np.where(dep > 20, "Excess", "Normal"))
        trend = stats.linregress(g["YEAR"], g["ANNUAL"])
        out[name] = {
            "mean_annual": r1(mean),
            "cv_pct": r1(g["ANNUAL"].std() / mean * 100),
            "monthly_normal": [r1(g[m].mean()) for m in MONTHS],
            "sw_share_pct": r1(g["JJAS"].mean() / mean * 100),
            "ne_share_pct": r1(g["OND"].mean() / mean * 100),
            "trend_mm_per_decade": r1(trend.slope * 10),
            "trend_p": round(float(trend.pvalue), 2),
            "years": [
                {"year": int(y), "annual": r1(a), "jjas": r1(j), "ond": r1(o), "dep": r1(d), "cat": c, "roll10": r1(rl)}
                for y, a, j, o, d, c, rl in zip(g["YEAR"], g["ANNUAL"], g["JJAS"], g["OND"], dep, cat,
                                                g["ANNUAL"].rolling(10).mean())
            ],
            "counts": {k: int((cat == k).sum()) for k in ["Deficient", "Normal", "Excess"]},
        }
        print(f"{name}: mean {mean:.0f} mm, deficient years {out[name]['counts']['Deficient']}, "
              f"trend {trend.slope * 10:+.1f} mm/decade p={trend.pvalue:.2f}")
    return out, ap


def crop_part(ap_rain):
    crops = pd.read_csv(CROP_CSV)
    n_years = crops["Crop_Year"].nunique()

    top_area = (crops.groupby("Crop")["Area"].sum() / n_years / 1e5).sort_values(ascending=False).head(8)

    def share(crop):
        s = crops[crops["Crop"] == crop].groupby("District_Name")["Production"].sum()
        return (s / s.sum() * 100).round(1)

    rice, groundnut, chilli, cotton = share("Rice"), share("Groundnut"), share("Dry chillies"), share("Cotton(lint)")
    area = crops.groupby("District_Name")["Area"].sum() / n_years / 1e5
    districts = {}
    for d in sorted(crops["District_Name"].unique()):
        top = crops[crops["District_Name"] == d].groupby("Crop")["Area"].sum().idxmax()
        districts[d] = {
            "region": "Rayalaseema" if d in RAYALASEEMA else "Coastal AP",
            "rice_share": r1(rice.get(d, 0)), "groundnut_share": r1(groundnut.get(d, 0)),
            "chilli_share": r1(chilli.get(d, 0)), "cotton_share": r1(cotton.get(d, 0)),
            "avg_area_lakh_ha": round(float(area[d]), 2), "top_crop": top,
        }
    print("Godavari + Krishna + Guntur rice share: %.1f%%" % rice[["West Godavari", "East Godavari", "Krishna", "Guntur"]].sum())
    print("Guntur chilli share: %.1f%%" % chilli["Guntur"])

    rain_r = ap_rain[ap_rain["SUBDIVISION"] == "Rayalaseema"].set_index("YEAR")
    rain_c = ap_rain[ap_rain["SUBDIVISION"] == "Coastal AP"].set_index("YEAR")

    gn = (crops[(crops["Crop"] == "Groundnut") & (crops["Season"] == "Kharif") & crops["District_Name"].isin(RAYALASEEMA)]
          .groupby("Crop_Year")[["Area", "Production"]].sum())
    gn["yield"] = gn["Production"] / gn["Area"]
    gn["rain"] = rain_r["JJAS"].reindex(gn.index)

    rc = (crops[(crops["Crop"] == "Rice") & ~crops["District_Name"].isin(RAYALASEEMA)]
          .groupby("Crop_Year")[["Area", "Production"]].sum())
    rc["yield"] = rc["Production"] / rc["Area"]
    rc["rain"] = rain_c["ANNUAL"].reindex(rc.index)

    def corr(df):
        r, p = stats.pearsonr(df["rain"], df["yield"])
        fit = stats.linregress(df["rain"], df["yield"])
        return {"r": round(float(r), 2), "p": float(f"{p:.2g}"), "slope": float(fit.slope), "intercept": float(fit.intercept),
                "points": [{"year": int(y), "rain": r1(row["rain"]), "yield": round(float(row["yield"]), 3)} for y, row in df.iterrows()]}

    g, c = corr(gn), corr(rc)
    print(f"groundnut r = {g['r']} p = {g['p']}, rice r = {c['r']} p = {c['p']}")
    return {
        "years": [int(crops["Crop_Year"].min()), int(crops["Crop_Year"].max())],
        "top_area": [{"crop": k, "lakh_ha": round(float(v), 2)} for k, v in top_area.items()],
        "districts": districts,
        "groundnut": g,
        "rice": c,
    }


def main():
    rain, ap_rain = rainfall_part()
    data = {"rain": rain, "crops": crop_part(ap_rain)}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    print("saved", OUT, os.path.getsize(OUT) // 1024, "KB")


if __name__ == "__main__":
    main()
