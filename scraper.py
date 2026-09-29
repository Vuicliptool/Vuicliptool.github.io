import time
import json
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from bs4 import BeautifulSoup

def scrape_facebook_reels():
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")
    
    # Giả lập User-Agent trình duyệt di động
    chrome_options.add_argument("user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1")

    print("Đang khởi động trình duyệt Chrome ẩn...")
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)

    target_url = "https://m.facebook.com/profile.php?id=100095001184360&name=xhp_nt__fblite__profile__tab_bar&profile_tab_item_selected=reels"
    
    try:
        print(f"Đang truy cập: {target_url}")
        driver.get(target_url)
        time.sleep(8)  # Chờ trang load ban đầu

        print("Đang tiến hành cuộn trang để nạp Reels...")
        for i in range(5):
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(4)
            print(f"Cuộn lần {i+1}/5")

        page_source = driver.page_source
        soup = BeautifulSoup(page_source, 'html.parser')

        reels_data = []
        
        # Quét tất cả các thẻ a có chứa đường dẫn trên trang di động
        all_links = soup.find_all('a', href=True)
        
        for link in all_links:
            href = link['href']
            # Lọc các liên kết thuộc về Reels hoặc video của Facebook
            if "/reel/" in href or "/videos/" in href or "/watch/" in href:
                # Xử lý chuẩn hóa URL đầy đủ
                if href.startswith("http"):
                    full_link = href
                else:
                    full_link = f"https://www.facebook.com{href}"
                
                # Làm sạch link (loại bỏ các tham số rườm rà nếu cần, hoặc giữ nguyên)
                # Lấy text làm tiêu đề nếu có
                title = link.get_text(strip=True)
                if not title or len(title) < 3:
                    title = "Trọng Sinh Cứu Thái Tử & Reels Hot"

                item = {
                    "title": title,
                    "video": full_link,
                    "poster": ""
                }
                
                # Tránh trùng lặp
                if item not in reels_data and "facebook.com" in full_link:
                    reels_data.append(item)

        print(f"Thu thập được tổng cộng: {len(reels_data)} video.")

        # Nếu không bắt được bằng cách thông thường, ta thêm dự phòng 1 mục mẫu cố định để kiểm tra web player
        if len(reels_data) == 0:
            print("Cảnh báo: Không quét tự động được do chính sách đăng nhập của Facebook, dùng bộ lọc mẫu.")
            # Bạn có thể đưa link video thủ công vào đây nếu muốn chắc chắn web hiển thị
            reels_data.append({
                "title": "Trọng Sinh Cứu Thái Tử, Chàng Quyết Không Buông Tay!",
                "video": target_url,
                "poster": ""
            })

        # Lưu ra file movies.json
        with open("movies.json", "w", encoding="utf-8") as f:
            json.dump(reels_data, f, ensure_ascii=False, indent=4)
        
        print("Đã ghi file movies.json thành công!")

    except Exception as e:
        print(f"Lỗi xảy ra: {e}")
        # Ghi file phòng hờ lỗi để tránh lỗi mảng trống
        with open("movies.json", "w", encoding="utf-8") as f:
            json.dump([{"title": "Video Trọng Sinh", "video": "https://www.facebook.com/", "poster": ""}], f, ensure_ascii=False, indent=4)
            
    finally:
        driver.quit()

if __name__ == "__main__":
    scrape_facebook_reels()
