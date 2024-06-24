import { IdentifiedTarget, ManualTargetMatch, MatchedTarget } from '../protos/obc.pb';

/**
 * 
 * @param setFoundItemArray set state for found items
 * @param setMatchedItemArray set state for matched items
 */
export async function pull_targets(setFoundItemArray: React.Dispatch<React.SetStateAction<IdentifiedTarget[]>>, setMatchedItemArray: React.Dispatch<React.SetStateAction<MatchedTarget[]>>) {
    const response = await fetch('/api/targets/all')
    const data = await response.json() as IdentifiedTarget[];
    data.forEach( d => {
        if (!('id' in d)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (d as any).id = 0; // stupid hack because protobuf doesn't serialize 0 values
            console.log("fix id 0 in list of all targets");
        }
    });
    setFoundItemArray([...data]);

    const response1 = await fetch('/api/targets/matched')
    const data1 = await response1.json() as MatchedTarget[];
    data1.forEach( d => {
        if (d.Target == undefined) {
            return;
        }

        if (!('id' in d.Target)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (d.Target as any).id = 0; // stupid hack because protobuf doesn't serialize 0 values
            console.log("fix id 0 in list of matched targets");
        }
    });
    setFoundItemArray([...data]);
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        switch (target.Bottle?.Index as any) {
            // hack because these are strings instead of num values for some reason
            case "A":
                matchings.bottleAId = target.Target?.id || -1;
                break;
            case "B":
                matchings.bottleBId = target.Target?.id || -1;
                break;
            case "C":
                matchings.bottleCId = target.Target?.id || -1;
                break;
            case "D":
                matchings.bottleDId = target.Target?.id || -1;
                break;
            case "E":
                matchings.bottleEId = target.Target?.id || -1;
                break;
            default:
                break;
        }
    });

    // -1 value gets set to 0 because 0 is the null value, but 0 is a real value we want to
    // send, so we artificially increment by 1.
    // that way when the OBC sees 1 it knows it is actually referring to target 0, and if it
    // sees 0 then it knows that it was referring to a target you aren't rematching
    matchings.bottleAId++;
    matchings.bottleBId++;
    matchings.bottleCId++;
    matchings.bottleDId++;
    matchings.bottleEId++;

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