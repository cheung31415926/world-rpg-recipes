# -*- coding: utf-8 -*-
"""
Created on Sat Sep  5 17:51:21 2026

@author: Cheung
"""

from pathlib import Path
from glob import glob
import json
import re
import pandas as pd

remove_color_code = lambda t: \
    re.sub(r"(\|c.{8})", "", t).replace("|r", "").replace("\r", "")

def get_item_description():
    paths = glob("./txt/*.txt")
    paths = [Path(p) for p in paths]
    paths = {p.name.replace(p.suffix, ""):p.resolve() for p in paths}
    
    item_path = paths["item"]
    with open(item_path, "r", encoding="utf-8-sig") as f:    
        text = remove_color_code(f.read())
        
    data = []
    for key, value in json.loads(text).items():
        name = value.get("name")
        description = value.get("description")
        data.append([key, name, description])
    
    return pd.DataFrame(data, columns=("key", "name", "description"))

def get_item_id():
    with open("item_id.txt", "r", encoding="utf-8-sig") as f:
        text = remove_color_code(f.read())
    texts = re.findall(("(?<=\").+(?=\")"), text)
    data = [t.split(" ", maxsplit=1) for t in texts 
            if "Default string" not in t]
    
    return pd.DataFrame(data, columns=("id", "name"))

df2 = get_item_id()

def convert(name):
    df = df2[df2.name==name]
    if df.empty:
        return -1
    return df.iloc[0].id

df1 = get_item_description()
df1["id"] = df1.name.apply(lambda x: convert(x))

df1.to_csv("data.csv", encoding="utf-8-sig")