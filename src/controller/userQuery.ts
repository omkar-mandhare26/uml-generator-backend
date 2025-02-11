import generatePlantUMLCode from "../utils/generatePlantUMLCode.js";
import generateFileName from "../utils/generateFileName.js";
import getSystemPrompt from "../utils/getSystemPrompt.js";
import fetchUserQuery from "../utils/fetchUserQuery.js";
import axiosInstance from "../utils/axiosInstance.js";
import addWatermark from "../utils/addWatermark.js";
import type { Request, Response } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import dotenv from "dotenv";

const execPromise = promisify(exec);
dotenv.config();

const userQuery = async (req: Request, res: Response) => {
    try {
        const { userPrompt, diagramType } = req.body;
        const token =
            req.cookies.token ||
            req.header("Authorization")?.replace("Bearer ", "");
        const { user, access } = (
            await axiosInstance.post(
                "/user/me",
                {},
                {
                    headers: {
                        Authorization: token,
                    },
                }
            )
        ).data;
        const diagramName = generateFileName(user, diagramType);
        const systemPrompt = getSystemPrompt(diagramType, diagramName);
        const diagramCode: string = await fetchUserQuery(
            systemPrompt,
            userPrompt
        );

        await generatePlantUMLCode(diagramCode, `${diagramName}.puml`);
        await execPromise(
            `java -jar plantuml.jar -o "../diagram/" "./generation/code/${diagramName}.puml" -tpng`
        );
        const responsePayload: any = {
            png_url: `http://localhost:5050/api/diagram/retrieve-png-diagram/${diagramName}`,
        };

        if (access === "free") {
            await addWatermark(`${diagramName}.png`, {
                opacity: 0.15,
                scale: 0.4,
            });
            responsePayload.msg = "Free User";
        } else if (access === "pro") {
            responsePayload.msg = "Pro User";
        } else {
            await execPromise(
                `java -jar plantuml.jar -o "../diagram/" "./generation/code/${diagramName}.puml" -tsvg`
            );

            responsePayload.msg = "Professional User";
            responsePayload.svg_url = `http://localhost:5050/api/diagram/retrieve-svg-diagram/${diagramName}`;
            responsePayload.code_url = `http://localhost:5050/api/diagram/retrieve-plantuml-code/${diagramName}`;
        }

        res.json(responsePayload);
    } catch (err) {
        if (err instanceof Error) {
            res.status(500).json({
                isError: true,
                errMessage: `Error From Query: ${err.message}`,
            });
            console.log(`Error: ${err.message}`);
        } else {
            res.status(500).json({
                isError: true,
                errMessage: "Unknown Error",
            });
            console.log("Unknown error");
        }
    }
};

export default userQuery;
