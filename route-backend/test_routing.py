import os

import requests

MAPBOX_TOKEN = os.environ["MAPBOX_TOKEN"]

# 各拠点の入力テキスト
point_1_text = "徳島駅"
point_2_text = "鳴門IC"
point_3_text = "垂水IC"
point_4_text = "亀岡市亀岡駅"

# ① ジオコーディング関数（テキスト ➔ 緯度経度）
def get_coordinates(search_text):
    url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{search_text}.json"
    params = {
        "access_token": MAPBOX_TOKEN, 
        "country": "JP", 
        "language": "ja"
    }

    response = requests.get(url, params=params)
    res = response.json()

    if response.status_code == 200 and len(res.get('features', [])) > 0:
        return res['features'][0]['geometry']['coordinates']
    else:
        print(f"「{search_text}」の位置情報が見つかりませんでした。")
        return None


# ② ルート検索関数（2地点の座標 ➔ 距離・時間・ルート形状）
def get_route_info(start_coord, end_coord):
    url = f"https://api.mapbox.com/directions/v5/mapbox/driving/{start_coord[0]},{start_coord[1]};{end_coord[0]},{end_coord[1]}"
    params = {
        "access_token": MAPBOX_TOKEN,
        "geometries": "geojson",
        "overview": "full"
    }
    
    response = requests.get(url, params=params)
    res = response.json()
    
    if response.status_code == 200 and "routes" in res and len(res["routes"]) > 0:
        route = res["routes"][0]
        return {
            "distance_km": route["distance"] / 1000,
            "duration_min": route["duration"] / 60,
            "geometry": route["geometry"]
        }
    return None

# --- メイン処理 ---

# 1. 4拠点の座標を取得
p1_coord = get_coordinates(point_1_text)
p2_coord = get_coordinates(point_2_text)
p3_coord = get_coordinates(point_3_text)
p4_coord = get_coordinates(point_4_text)

print(f"1. {point_1_text}: {p1_coord}")
print(f"2. {point_2_text}: {p2_coord}")
print(f"3. {point_3_text}: {p3_coord}")
print(f"4. {point_4_text}: {p4_coord}")

# 2. 3つの区間（Leg）のルートをそれぞれ計算
leg1 = get_route_info(p1_coord, p2_coord) # 下道1: 徳島 ➔ 鳴門IC
leg2 = get_route_info(p2_coord, p3_coord) # 高速  : 鳴門IC ➔ 垂水IC
leg3 = get_route_info(p3_coord, p4_coord) # 下道2: 垂水IC ➔ 亀岡

# 3. 合計値の算出
total_distance = leg1["distance_km"] + leg2["distance_km"] + leg3["distance_km"]
total_duration = leg1["duration_min"] + leg2["duration_min"] + leg3["duration_min"]

print("\n================== ルート算出結果 ==================")
print(f"【Leg 1】下道 ({point_1_text} ➔ {point_2_text}): {leg1['distance_km']:.1f} km / {leg1['duration_min']:.0f} 分")
print(f"【Leg 2】高速 ({point_2_text} ➔ {point_3_text}): {leg2['distance_km']:.1f} km / {leg2['duration_min']:.0f} 分")
print(f"【Leg 3】下道 ({point_3_text} ➔ {point_4_text}): {leg3['distance_km']:.1f} km / {leg3['duration_min']:.0f} 分")
print("--------------------------------------------------")
print(f"合計走行距離 : {total_distance:.1f} km")
print(f"合計所要時間 : {total_duration / 60:.1f} 時間 ({total_duration:.0f} 分)")
print("==================================================")