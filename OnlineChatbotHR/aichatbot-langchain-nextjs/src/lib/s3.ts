import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

export class S3Storage {
    private s3client: S3Client;
    constructor() {
        this.s3client = new S3Client({
            region: "auto",
            endpoint: process.env.AWS_ENDPOINT,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
            },
        });
    }

    async uploadFile(file: File, folder: string) {
        const fileBuffer = await file.arrayBuffer();
        const fileName = `${folder}/${uuidv4()}-${file.name}`;
        const command = new PutObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: fileName,
            ContentType: file.type,
            Body: new Uint8Array(fileBuffer),
        });
        try{
        await this.s3client.send(command);
        return fileName;
    } catch (error) {
        console.error(error);
        throw error;
    }
    }
        
    
}
