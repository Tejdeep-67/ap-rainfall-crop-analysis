"""
Takes the all-India crop production file and keeps only Andhra Pradesh.

Download crop_production.csv first (link in the README) and put it in data/raw/.
The full file is ~15 MB so it is not in the repo, only the AP part is.

One problem I found: for some district/crop/year combinations there is a
"Whole Year" row that is just Kharif + Rabi added together (mostly 2013 and 2014).
Keeping it would count the same crop twice, so those rows are removed here.
"""
import os

import pandas as pd

BASE = os.path.join(os.path.dirname(__file__), "..")
RAW = os.path.join(BASE, "data", "raw", "crop_production.csv")
OUT = os.path.join(BASE, "data", "ap_crop_production.csv")


def drop_double_counted(df):
    keys = ["District_Name", "Crop_Year", "Crop"]
    seasonal = (df[df["Season"] != "Whole Year"]
                .groupby(keys)["Area"].sum()
                .rename("seasonal_area")
                .reset_index())
    df = df.merge(seasonal, on=keys, how="left")

    # whole year area equal (within 1%) to the seasonal total -> duplicate
    is_dup = ((df["Season"] == "Whole Year")
              & df["seasonal_area"].notna()
              & ((df["Area"] / df["seasonal_area"] - 1).abs() < 0.01))
    print("double counted 'Whole Year' rows removed:", int(is_dup.sum()))
    return df[~is_dup].drop(columns="seasonal_area")


def main():
    df = pd.read_csv(RAW)
    df["State_Name"] = df["State_Name"].str.strip()
    df["Season"] = df["Season"].str.strip()
    df["District_Name"] = df["District_Name"].str.strip().str.title()

    ap = df[df["State_Name"] == "Andhra Pradesh"].drop(columns="State_Name")
    print("AP rows:", len(ap))

    ap = drop_double_counted(ap)
    ap = ap.dropna(subset=["Production"])
    ap = ap.sort_values(["Crop_Year", "District_Name", "Season", "Crop"])

    ap.to_csv(OUT, index=False)
    print("saved", len(ap), "rows to", OUT)


if __name__ == "__main__":
    main()
