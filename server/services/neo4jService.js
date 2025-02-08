import { getSession } from '../config/neo4j.js';

export async function saveTokenInfo(tokenData) {
    const session = await getSession();
    try {
        await session.executeWrite(tx => 
            tx.run(
                `
                MERGE (t:Token {id: $tokenId})
                SET t.name = $name,
                    t.symbol = $symbol,
                    t.decimals = $decimals,
                    t.totalSupply = $totalSupply,
                    t.lastUpdated = datetime()
                RETURN t
                `,
                tokenData
            )
        );
    } finally {
        await session.close();
    }
}

export async function saveHolders(tokenId, holders) {
    const session = await getSession();
    try {
        await session.executeWrite(async tx => {
            // Create holders
            for (const holder of holders) {
                await tx.run(
                    `
                    MERGE (w:Wallet {id: $accountId})
                    MERGE (t:Token {id: $tokenId})
                    MERGE (w)-[h:HOLDS]->(t)
                    SET h.balance = $balance,
                        h.lastUpdated = datetime()
                    `,
                    {
                        accountId: holder.account,
                        tokenId: tokenId,
                        balance: holder.balance
                    }
                );
            }
        });
    } finally {
        await session.close();
    }
}

export async function saveTransactions(tokenId, transactions) {
    const session = await getSession();
    try {
        await session.executeWrite(async tx => {
            for (const transaction of transactions) {
                await tx.run(
                    `
                    MATCH (sender:Wallet {id: $senderId})
                    MATCH (receiver:Wallet {id: $receiverId})
                    MERGE (sender)-[t:TRANSFERRED {
                        tokenId: $tokenId,
                        transactionId: $txId
                    }]->(receiver)
                    SET t.amount = $amount,
                        t.timestamp = datetime($timestamp),
                        t.memo = $memo
                    `,
                    {
                        senderId: transaction.sender_account,
                        receiverId: transaction.receiver_account,
                        tokenId: tokenId,
                        txId: transaction.transaction_id,
                        amount: transaction.sender_amount,
                        timestamp: transaction.timestamp,
                        memo: transaction.memo
                    }
                );
            }
        });
    } finally {
        await session.close();
    }
}

export async function getTokenData(tokenId) {
    const session = await getSession();
    try {
        // Get token info
        const tokenResult = await session.executeRead(tx =>
            tx.run(
                `
                MATCH (t:Token {id: $tokenId})
                RETURN t
                `,
                { tokenId }
            )
        );

        if (tokenResult.records.length === 0) {
            return null;
        }

        // Get holders
        const holdersResult = await session.executeRead(tx =>
            tx.run(
                `
                MATCH (w:Wallet)-[h:HOLDS]->(t:Token {id: $tokenId})
                RETURN w.id as account, h.balance as balance
                `,
                { tokenId }
            )
        );

        // Get transactions
        const transactionsResult = await session.executeRead(tx =>
            tx.run(
                `
                MATCH (sender:Wallet)-[t:TRANSFERRED {tokenId: $tokenId}]->(receiver:Wallet)
                RETURN sender.id as sender_account,
                       receiver.id as receiver_account,
                       t.amount as amount,
                       t.timestamp as timestamp,
                       t.transactionId as transaction_id,
                       t.memo as memo
                ORDER BY t.timestamp DESC
                `,
                { tokenId }
            )
        );

        return {
            token: tokenResult.records[0].get('t').properties,
            holders: holdersResult.records.map(record => ({
                account: record.get('account'),
                balance: record.get('balance').toNumber()
            })),
            transactions: transactionsResult.records.map(record => ({
                sender_account: record.get('sender_account'),
                receiver_account: record.get('receiver_account'),
                amount: record.get('amount').toNumber(),
                timestamp: record.get('timestamp'),
                transaction_id: record.get('transaction_id'),
                memo: record.get('memo')
            }))
        };
    } finally {
        await session.close();
    }
}