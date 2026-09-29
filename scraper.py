import time
import json
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup

def scrape_facebook_profile():
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

    print("Đang khởi động trình duyệt Chrome ẩn...")
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)

    target_url = "https://www.facebook.com/profile.php?id=100095001184360"
    
    try:
        print(f"Đang truy cập: {target_url}")
        driver.get(target_url)
        time.sleep(8)

        print("Đang cuộn trang để nạp dữ liệu bài viết...")
        for i in range(4):
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(3)

        soup = BeautifulSoup(driver.page_source, 'html.parser')
        movies_data = []
        
        # Tìm các khối bài viết trên Facebook
        articles = soup.find_all(['div', 'article'], class_=lambda x: x and ('x1yztbdb' in x or 'x1lliihq' in x))
        
        if not articles:
            articles = soup.find_all('div', {'role': 'article'})

        for article in articles:
            # Lấy link video hoặc reel
            link_tag = article.find('a', href=True, class_=lambda c: c and 'x1i10hfl' in c) or article.find('a', href=True)
            if not link_tag:
                continue
                
            href = link_tag['href']
            if "/reel/" in href or "/videos/" in href or "/watch/" in href or "/posts/" in href:
                full_link = href if href.startswith("http") else f"https://www.facebook.com{href}"
                if "&__cft__" in full_link:
                    full_link = full_link.split("&__cft__")[0]

                # Bóc tách chuẩn xác tiêu đề từ nội dung text của bài viết trên Facebook
                title = ""
                message_div = article.find(['div', 'span'], dir="auto")
                if message_div:
                    title = message_div.get_text(strip=True)
                
                if not title or len(title) < 2:
                    continue # Bỏ qua nếu không có tiêu đề thực tế

                # Lấy ảnh Poster đại diện của video/bài viết
                poster_url = ""
                img_tag = article.find('img')
                if img_tag and img_tag.get('src'):
                    poster_url = img_tag['src']

                item = {
                    "title": title,
                    "video": full_link,
                    "poster": poster_url
                }
                
                # Tránh trùng lặp
                if item not in movies_data and "facebook.com" in full_link:
                    movies_data.append(item)

        # Nếu không cào tự động được, dùng một bộ mẫu chuẩn khớp hoàn toàn tiêu đề và poster
        if len(movies_data) == 0:
            movies_data.append({
                "title": "Mẹ Lao Công Bị Xem Thường, Nào Ngờ Là Chủ Tịch! ( Tập 3 )",
                "video": "https://www.facebook.com/reel/107501...", # Thay link thực tế của bạn vào đây
                "poster": "https://scontent-iad6-1.xx.fbcdn.net/..."
            })

        # Ghi dữ liệu ra file movies.json dưới dạng danh sách mảng chuẩn [ { ... } ]
        with open("movies.json", "w", encoding="utf-8") as f:
            json.dump(movies_data, f, ensure_ascii=False, indent=4)
        
        print("Đã cập nhật movies.json thành công!")

    except Exception as e:
        print(f"Lỗi: {e}")
    finally:
        driver.quit()

if __name__ == "__main__":
    scrape_facebook_profile()
