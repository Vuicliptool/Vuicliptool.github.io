import json
import requests
from bs4 import BeautifulSoup

url = "https://fbwacth.com/"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

session = requests.Session()
session.headers.update(headers)

try:
    response = session.get(url, timeout=15)
    if response.status_code == 200:
        soup = BeautifulSoup(response.text, 'html.parser')
        movies = []
        
        items = soup.select('.movie-card, article, .grid > div')
        
        for item in items:
            title_el = item.find(['h3', 'a'])
            title = title_el.get_text(strip=True) if title_el else "Phim mới cập nhật"
            
            link_el = item.find('a')
            detail_url = ""
            if link_el and link_el.has_attr('href'):
                href = link_el['href']
                detail_url = href if href.startswith('http') else "https://fbwacth.com" + href
            
            # Lấy ảnh poster
            poster = ""
            poster_div = item.select_one('.poster, [style*="background-image"]')
            if poster_div and poster_div.get('style'):
                style = poster_div['style']
                if 'url(' in style:
                    start = style.find('url(') + 4
                    end = style.find(')', start)
                    poster = style[start:end].strip('\'"')
            
            dur_el = item.select_one('.duration')
            duration = dur_el.get_text(strip=True) if dur_el else "Full"
            
            # Quét link iframe xem phim và link tải về
            video_embed = "https://geo.dailymotion.com/player.html?video=xb1j9wq"
            download_url = detail_url if detail_url else url
            
            if detail_url:
                try:
                    detail_res = session.get(detail_url, timeout=10)
                    if detail_res.status_code == 200:
                        detail_soup = BeautifulSoup(detail_res.text, 'html.parser')
                        
                        # Lấy iframe xem phim
                        iframes = detail_soup.find_all('iframe')
                        for iframe in iframes:
                            src = iframe.get('src', '')
                            if any(keyword in src for keyword in ['dailymotion', 'player', 'embed', 'video']):
                                video_embed = src
                                break
                        
                        # Tìm nút/link tải về nếu có trên trang chi tiết
                        dl_btn = detail_soup.select_one('a[download], a.download-btn, .download-link')
                        if dl_btn and dl_btn.has_attr('href'):
                            dl_href = dl_btn['href']
                            download_url = dl_href if dl_href.startswith('http') else "https://fbwacth.com" + dl_href
                except:
                    pass
            
            if poster:
                movies.append({
                    "title": title,
                    "duration": duration,
                    "poster": poster,
                    "video": video_embed,
                    "download": download_url
                })
        
        if movies:
            with open('movies.json', 'w', encoding='utf-8') as f:
                json.dump(movies, f, ensure_ascii=False, indent=4)
            print(f"Đã cập nhật thành công {len(movies)} phim có kèm link tải!")
        else:
            print("Không tìm thấy thẻ phim nào.")
    else:
        print(f"Lỗi kết nối trang gốc: {response.status_code}")
except Exception as e:
    print(f"Lỗi: {e}")
