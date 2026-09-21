import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDocClient, ROUTE_CHOICES_TABLE_NAME } from "@/lib/dynamodb";
import type { RouteChoice, RouteChoiceMode, RouteChoicePoint } from "@/lib/types";

const VALID_MODES: RouteChoiceMode[] = ["ic", "avoidHighway", "fastest"];

export async function POST(req: NextRequest) {
  if (!ROUTE_CHOICES_TABLE_NAME) {
    return NextResponse.json({ error: "ROUTE_CHOICES_TABLE_NAMEが設定されていません" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const {
      sessionId,
      mode,
      origin,
      destination,
      entryIC,
      exitIC,
      totalDistanceKm,
      totalDurationMin,
    } = body as {
      sessionId?: string;
      mode?: RouteChoiceMode;
      origin?: RouteChoicePoint;
      destination?: RouteChoicePoint;
      entryIC?: RouteChoicePoint;
      exitIC?: RouteChoicePoint;
      totalDistanceKm?: number;
      totalDurationMin?: number;
    };

    if (!sessionId || !mode || !VALID_MODES.includes(mode)) {
      return NextResponse.json({ error: "sessionId・modeが不正です" }, { status: 400 });
    }
    if (!origin || !destination) {
      return NextResponse.json({ error: "originとdestinationは必須です" }, { status: 400 });
    }

    const choice: RouteChoice = {
      choiceId: randomUUID(),
      sessionId,
      createdAt: Date.now(),
      mode,
      origin,
      destination,
      entryIC,
      exitIC,
      totalDistanceKm: totalDistanceKm ?? 0,
      totalDurationMin: totalDurationMin ?? 0,
      completed: false,
    };

    await ddbDocClient.send(new PutCommand({ TableName: ROUTE_CHOICES_TABLE_NAME, Item: choice }));

    return NextResponse.json({ ok: true, choiceId: choice.choiceId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ルート選択の記録に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ナビを最後まで使い切った（＝そのルート選択が実際に有効だった）ことを記録する
export async function PATCH(req: NextRequest) {
  if (!ROUTE_CHOICES_TABLE_NAME) {
    return NextResponse.json({ error: "ROUTE_CHOICES_TABLE_NAMEが設定されていません" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { choiceId } = body as { choiceId?: string };
    if (!choiceId) {
      return NextResponse.json({ error: "choiceIdは必須です" }, { status: 400 });
    }

    await ddbDocClient.send(
      new UpdateCommand({
        TableName: ROUTE_CHOICES_TABLE_NAME,
        Key: { choiceId },
        UpdateExpression: "SET completed = :completed, completedAt = :completedAt",
        ExpressionAttributeValues: { ":completed": true, ":completedAt": Date.now() },
      })
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "完了記録の更新に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
