import sqlite3
import zipfile
import json
import os
import re
import argparse
import tempfile
import html

def clean_data(text):
    """强化版：清洗 HTML 标签、Anki 特有标签及实体符号"""
    if not text: return ""
    # 去除 [sound:xxx.mp3] 等 Anki 标签
    text = re.sub(r'\[sound:[^\]]+\]', '', text)
    # 去除所有 HTML 结构 (<img...>, <br>, <div>)
    text = re.sub(r'<[^>]+>', '', text)
    # 反转义 HTML 实体 (如 &nbsp; 变为空格)
    text = html.unescape(text)
    # 替换连续的空白符为单空格
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def process_apkg(input_file, output_file):
    # 使用安全的系统临时目录，执行后自动销毁
    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            with zipfile.ZipFile(input_file, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)
        except zipfile.BadZipFile:
            print("Error: 无效的 .apkg 压缩包格式")
            return
        
        db_path = os.path.join(temp_dir, "collection.anki21")
        if not os.path.exists(db_path):
            db_path = os.path.join(temp_dir, "collection.anki2")
            
        if not os.path.exists(db_path):
            print("Error: 未找到 collection.anki2 数据库")
            return
            
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute("SELECT flds FROM notes")
            rows = cursor.fetchall()
        except sqlite3.Error as e:
            print(f"Error: 数据库读取失败 - {e}")
            conn.close()
            return
        
        words_list = []
        for row in rows:
            fields = row[0].split('\x1f')
            # 兼容：至少要有两列数据，才能算做正常的抽认卡
            if len(fields) >= 2:
                japanese = clean_data(fields[0])
                reading = clean_data(fields[1]) if len(fields) > 1 else ""
                meaning = clean_data(fields[2]) if len(fields) > 2 else reading
                pos = clean_data(fields[3]) if len(fields) > 3 else "名词"
                
                if japanese: # 保证本体不为空
                    words_list.append({
                        "japanese": japanese,
                        "reading": reading if reading != meaning else "", # 防止读音和含义重复
                        "meaning": meaning,
                        "partOfSpeech": pos,
                        "tags": ["Anki转换"]
                    })
                
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(words_list, f, ensure_ascii=False, indent=2)
        
        conn.close()
        print(f"转换成功！共清洗处理了 {len(words_list)} 个单词。")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Anki .apkg 转 JSON 云端清洗工具")
    parser.add_argument("input", help="输入的 .apkg 文件路径")
    parser.add_argument("--output", default="converted_vocab.json", help="输出的 JSON 文件路径")
    args = parser.parse_args()
    
    process_apkg(args.input, args.output)
