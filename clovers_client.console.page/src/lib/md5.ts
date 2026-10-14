/**
 * md5.ts —— 分片计算文件 MD5，用于上传前去重（后端按 MD5 命名文件）。
 * 逻辑沿用旧版实现，只是拆成独立模块并补充了错误处理。
 */
import SparkMD5 from 'spark-md5';

const CHUNK_SIZE = 2 * 1024 * 1024;

export function fileMd5(file: File): Promise<string | null> {
    return new Promise((resolve) => {
        const spark = new SparkMD5.ArrayBuffer();
        const reader = new FileReader();
        let chunk = 0;
        const total = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));

        reader.onerror = () => resolve(null);
        reader.onload = (e) => {
            try {
                spark.append(e.target?.result as ArrayBuffer);
            } catch {
                resolve(null);
                return;
            }
            chunk++;
            if (chunk < total) next();
            else resolve(spark.end());
        };

        const next = () => {
            const start = chunk * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            reader.readAsArrayBuffer(file.slice(start, end));
        };

        next();
    });
}
