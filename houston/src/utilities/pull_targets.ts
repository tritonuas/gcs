import { IdentifiedTarget, MatchedTarget } from '../protos/obc.pb';

/**
 * 
 * @param setFoundItemArray set state for found items
 * @param setMatchedItemArray set state for matched items
 */
export async function pull_targets(setFoundItemArray: React.Dispatch<React.SetStateAction<IdentifiedTarget[]>>, setMatchedItemArray: React.Dispatch<React.SetStateAction<MatchedTarget[]>>) {
    const response = await fetch('/api/targets/all')
    const data = await response.json();
    setFoundItemArray([...data]);

    const response1 = await fetch('/api/targets/matched')
    const data1 = await response1.json();
    setMatchedItemArray([...data1]);
}

/**
 * 
 * @param targets array of matched targets
 * @returns boolean
 */
export async function post_targets(targets: MatchedTarget[]) {
    console.log(targets);
    const data = await fetch('/api/targets/matched', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(targets),
    })
    console.log('Success:', data);
    return true;
}