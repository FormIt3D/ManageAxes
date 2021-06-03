if (typeof ManageAxes == 'undefined')
{
    ManageAxes = {};
}

/*** web/UI code - runs natively in the plugin process ***/

// flag to indicate a selection is in progress
let bIsSelectionInProgress = false;

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
    contentContainer.appendChild(new FormIt.PluginUI.HeaderModule('Set LCS On Face', 'Select a face to set the local coordinate system on, with the Z-axis perpendicular to the face.').element);

    // create the button set the LCS on the selected face
    contentContainer.appendChild(new FormIt.PluginUI.Button('Set LCS on Face', ManageAxes.setLCSOnSelectedFace).element);

    // create the footer
    document.body.appendChild(new FormIt.PluginUI.FooterModule().element);
}

/*** application code - runs asynchronously from plugin process to communicate with FormIt ***/

// get the current selection (must be a face), get the face centroid
// and set the LCS there, with Z-axis perpendicular to face normal
ManageAxes.setLCSOnSelectedFace = function()
{

}
