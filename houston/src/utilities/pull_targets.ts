import { BottleDropIndex, IdentifiedTarget, ManualTargetMatch, MatchedTarget } from '../protos/obc.pb';

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

    // should probably update function signature to already take in this format but whatever
    // just doing quick hacks to get ready for competition

    const matchings: ManualTargetMatch = {
        bottleAId: -1,
        bottleBId: -1,
        bottleCId: -1,
        bottleDId: -1,
        bottleEId: -1,
    };

    targets.forEach((target) => {
        switch (target.Bottle?.Index) {
            case BottleDropIndex.A:
                matchings.bottleAId = target.Target?.id || -1;
                break;
            case BottleDropIndex.B:
                matchings.bottleBId = target.Target?.id || -1;
                break;
            case BottleDropIndex.C:
                matchings.bottleCId = target.Target?.id || -1;
                break;
            case BottleDropIndex.D:
                matchings.bottleDId = target.Target?.id || -1;
                break;
            case BottleDropIndex.E:
                matchings.bottleEId = target.Target?.id || -1;
                break;
            default:
                break;
        }
    });

    const data = await fetch('/api/targets/matched', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(matchings),
    })
    console.log('Success:', data);
    return true;
}