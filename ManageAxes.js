if (typeof ManageAxes == 'undefined')
{
    ManageAxes = {};
}

/*** web/UI code - runs natively in the plugin process ***/

// IDs of input elements that need to be referenced or updated

ManageAxes.initializeUI = async function()
{
    // create an overall container for all objects that comprise the "content" of the plugin
    // everything except the footer
    let contentContainer = document.createElement('div');
    contentContainer.id = 'contentContainer';
    contentContainer.className = 'contentContainer'
    window.document.body.appendChild(contentContainer);

    // create the header
    contentContainer.appendChild(new FormIt.PluginUI.HeaderModule('Manage Axes', 'Modify local and world coordinate systems between Group contexts.').element);

    // separator and space
    contentContainer.appendChild(document.createElement('p'));
    contentContainer.appendChild(document.createElement('hr'));
    contentContainer.appendChild(document.createElement('p'));

    // create the subsection for setting the LCS at the selected face 
    contentContainer.appendChild(new FormIt.PluginUI.HeaderModule('Align LCS with Face', 'Select a face to align the local coordinate system with.').element);

    // create the button to set the LCS on the selected face
    contentContainer.appendChild(new FormIt.PluginUI.Button('Align LCS with Face', ManageAxes.setLCSOnSelectedFace).element);

    // create the footer
    document.body.appendChild(new FormIt.PluginUI.FooterModule().element);
}

/*** application code - runs asynchronously from plugin process to communicate with FormIt ***/

// the editing context
let nHistoryID;

// if a single face is selected, returns its ID
// otherwise, returns -1
ManageAxes.getAlignmentFaceID = async function()
{
    nHistoryID = await FormIt.GroupEdit.GetEditingHistoryID();

    let currentSelection = await FormIt.Selection.GetSelections();
    
    if (currentSelection.length == 1)
    {
        // if not in the Main History, need to calculate the depth to extract the correct history data
        let historyDepth = (currentSelection[0]["ids"].length) -1;
        //console.log("Current history depth: " + historyDepth);

        let nObjectID = currentSelection[0]["ids"][historyDepth]["Object"];
        let objectType = await WSM.APIGetObjectTypeReadOnly(nHistoryID, nObjectID);
        console.log("Object type: " + objectType);

        if (objectType == WSM.nObjectType.nFaceType)
        {
            return nObjectID;
        }
        else 
        {
            return -1;
        }
    }
    else
    {
        return -1;
    }
}

ManageAxes.setLCSOnSelectedFace = async function()
{
    // get the selected face ID
    // if -1, the selection is not valid
    let nAlignmentFaceID = await ManageAxes.getAlignmentFaceID();

    if (nAlignmentFaceID != -1)
    {
        // get the centroid of the face
        let faceCentroidPoint3D = await WSM.APIGetFaceCentroidPoint3dReadOnly(nHistoryID, nAlignmentFaceID);
        console.log("Face centroid: " + JSON.stringify(faceCentroidPoint3D));

        // get the normal at the centroid
        let normals = await WSM.APIGetFaceVertexNormalsReadOnly(nHistoryID, nAlignmentFaceID);
        console.log("Normals: " + JSON.stringify(normals));

        let singleNormal = normals[0];

        let singleNormalX = singleNormal["second"]["x"];
        let singleNormalY = singleNormal["second"]["y"];
        let singleNormalZ = singleNormal["second"]["z"];

        let singleNormal2 = singleNormal["second"];

        // create a new transf3d at the face centroid
        let newLCS = await WSM.Geom.MakeRigidTransform(faceCentroidPoint3D, singleNormal2, singleNormal2, singleNormal2);
        console.log(JSON.stringify(newLCS));

        let facePlane = await WSM.APIGetFacePlaneReadOnly(nHistoryID, nAlignmentFaceID);
        console.log("Face plane: " + JSON.stringify(facePlane));

        // set the new LCS
        await WSM.APISetLocalCoordinateSystem(nHistoryID, newLCS);

        //let currentLCS = await  WSM.APIGetLocalCoordinateSystemReadOnly(nHistoryID);
        //console.log("Current LCS: " + JSON.stringify(currentLCS));
    }
    else 
    {
        let failureMessage = "Select a single face to align the LCS to."
        await FormIt.UI.ShowNotification(failureMessage, FormIt.NotificationType.Information, 0);
    }
}
